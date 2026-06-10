import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/app/lib/db';

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const changes = closes.slice(1).map((p, i) => p - closes[i]);
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss -= changes[i];
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + (changes[i] > 0 ? changes[i] : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (changes[i] < 0 ? -changes[i] : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcMACD(closes: number[]) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine.slice(25), 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { macd, signal, histogram: macd - signal };
}

function calcBB(closes: number[], period = 20) {
  if (closes.length < period) {
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
    return { upper: mean, middle: mean, lower: mean };
  }
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
}

function generateSignal(rsi: number, macd: number, macdSignal: number, price: number, bb: { upper: number; middle: number; lower: number }) {
  let score = 50;
  if (rsi < 30) score += 20;
  else if (rsi > 70) score -= 20;
  else if (rsi < 40) score += 10;
  else if (rsi > 60) score -= 10;
  if (macd > macdSignal) score += 15;
  else score -= 15;
  if (price < bb.lower) score += 10;
  else if (price > bb.upper) score -= 10;
  score = Math.max(0, Math.min(100, score));
  const type: 'BUY' | 'SELL' | 'HOLD' = score >= 65 ? 'BUY' : score <= 35 ? 'SELL' : 'HOLD';
  return { type, strength: score };
}

async function fetchTiingo(startDate: string, resampleFreq: string) {
  const token = process.env.TIINGO_API_KEY;
  const url = `https://api.tiingo.com/tiingo/fx/xauusd/prices?startDate=${startDate}&resampleFreq=${resampleFreq}&token=${token}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`Tiingo ${res.status}: ${await res.text()}`);
  return res.json() as Promise<Array<{ date: string; open: number; high: number; low: number; close: number }>>;
}

const TF_CONFIGS = [
  { dbTf: '5m',  tiingoFreq: '5min',  daysBack: 2,  minRows: 30, lookback: 60 },
  { dbTf: '1h',  tiingoFreq: '1Hour', daysBack: 7,  minRows: 30, lookback: 60 },
  { dbTf: '4h',  tiingoFreq: '4Hour', daysBack: 30, minRows: 26, lookback: 60 },
  { dbTf: '1d',  tiingoFreq: '1Day',  daysBack: 90, minRows: 26, lookback: 60 },
];

export async function POST(_request: NextRequest) {
  try {
    const results: any[] = [];

    for (const tf of TF_CONFIGS) {
      // ── Selalu fetch dari Tiingo tanpa stale check ─────────────────────────
      const startDate = new Date(Date.now() - tf.daysBack * 24 * 3600 * 1000)
        .toISOString().split('T')[0];

      let inserted = 0;
      try {
        const candles = await fetchTiingo(startDate, tf.tiingoFreq);
        for (const c of candles) {
          const ts = new Date(c.date).toISOString().slice(0, 19).replace('T', ' ');
          await execute(
            `INSERT IGNORE INTO prices (timestamp, timeframe, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [ts, tf.dbTf, c.open, c.high, c.low, c.close]
          );
          inserted++;
        }
        results.push({ tf: tf.dbTf, fetched: candles.length, inserted });
      } catch (e: any) {
        results.push({ tf: tf.dbTf, error: e.message });
        continue;
      }

      // ── Generate signal dari data terbaru ──────────────────────────────────
      const rows = await query<{ close: string; timestamp: string }>(
        `SELECT close, timestamp FROM prices WHERE timeframe = ? ORDER BY timestamp DESC LIMIT ?`,
        [tf.dbTf, tf.lookback]
      );

      if (rows.length < tf.minRows) {
        results.push({ tf: tf.dbTf, signal: 'skipped - not enough data', rows: rows.length });
        continue;
      }

      const closes = rows.map(r => parseFloat(r.close)).reverse();
      const latestClose = closes[closes.length - 1];
      const latestTs = rows[0].timestamp;

      const rsi = calcRSI(closes);
      const { macd, signal: macdSignal, histogram } = calcMACD(closes);
      const bb = calcBB(closes);
      const { type, strength } = generateSignal(rsi, macd, macdSignal, latestClose, bb);

      const indicators = JSON.stringify({ rsi, macd, macdSignal, macdHistogram: histogram, bb });
      const signalTs = new Date(latestTs).toISOString().slice(0, 19).replace('T', ' ');

      // Upsert — update kalau sudah ada, insert kalau belum
      await execute(
        `INSERT INTO signals (timestamp, timeframe, type, strength, price, indicators)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE type=VALUES(type), strength=VALUES(strength), price=VALUES(price), indicators=VALUES(indicators)`,
        [signalTs, tf.dbTf, type, strength, latestClose, indicators]
      );

      results.push({ tf: tf.dbTf, signal: { type, strength, rsi: rsi.toFixed(1), price: latestClose } });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to force-fetch all timeframes' });
}