import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/app/lib/db';

// ── Technical Indicators ──────────────────────────────────────────────────────

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

function generateSignal(
  rsi: number,
  macd: number,
  macdSignal: number,
  price: number,
  bb: { upper: number; middle: number; lower: number }
) {
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

// ── Tiingo fetch ──────────────────────────────────────────────────────────────

async function fetchTiingo(startDate: string, resampleFreq: string) {
  const token = process.env.TIINGO_API_KEY;
  const url = `https://api.tiingo.com/tiingo/fx/xauusd/prices?startDate=${startDate}&resampleFreq=${resampleFreq}&token=${token}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`Tiingo error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<Array<{ date: string; open: number; high: number; low: number; close: number }>>;
}

const TF_CONFIGS = [
  { dbTf: '5m',  tiingoFreq: '5min',  staleHours: 5/60,  daysBack: 2,   minRows: 30, lookback: 60 },
  { dbTf: '15m', tiingoFreq: '15min', staleHours: 15/60, daysBack: 5,   minRows: 30, lookback: 60 },
  { dbTf: '30m', tiingoFreq: '30min', staleHours: 30/60, daysBack: 10,  minRows: 30, lookback: 60 },
  { dbTf: '1h',  tiingoFreq: '1Hour', staleHours: 1,     daysBack: 7,   minRows: 30, lookback: 60 },
  { dbTf: '4h',  tiingoFreq: '4Hour', staleHours: 4,     daysBack: 30,  minRows: 26, lookback: 60 },
  { dbTf: '1d',  tiingoFreq: '1Day',  staleHours: 24,    daysBack: 90,  minRows: 26, lookback: 60 },
  { dbTf: '1w',  tiingoFreq: '1Week', staleHours: 24*7,  daysBack: 730, minRows: 20, lookback: 52 },
];

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const prices = await query<any>(
      `SELECT * FROM prices WHERE timeframe = '1h' ORDER BY timestamp DESC LIMIT 100`
    );
    return NextResponse.json({ success: true, data: prices.reverse(), count: prices.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    // Remove duplicate signals
    await execute(
      `DELETE s1 FROM signals s1
       INNER JOIN signals s2
       WHERE s1.timestamp = s2.timestamp AND s1.timeframe = s2.timeframe AND s1.id < s2.id`
    );

    const fetchedTfs: string[] = [];
    let totalInserted = 0;

    // ── Step 1: Fetch OHLC data for all timeframes ────────────────────────────
    for (const tf of TF_CONFIGS) {
      const [lastRow] = await query<{ last_ts: string }>(
        `SELECT MAX(timestamp) as last_ts FROM prices WHERE timeframe = ?`,
        [tf.dbTf]
      );

      const lastTs = lastRow?.last_ts ? new Date(lastRow.last_ts) : null;
      const staleThreshold = new Date(Date.now() - tf.staleHours * 3600 * 1000);

      if (lastTs && lastTs > staleThreshold) continue;

      const maxDaysAgo = new Date(Date.now() - tf.daysBack * 24 * 3600 * 1000);
      const startDate = lastTs && lastTs > maxDaysAgo
        ? lastTs.toISOString().split('T')[0]
        : maxDaysAgo.toISOString().split('T')[0];

      try {
        const candles = await fetchTiingo(startDate, tf.tiingoFreq);
        for (const c of candles) {
          const ts = new Date(c.date).toISOString().slice(0, 19).replace('T', ' ');
          await execute(
            `INSERT IGNORE INTO prices (timestamp, timeframe, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [ts, tf.dbTf, c.open, c.high, c.low, c.close]
          );
          totalInserted++;
        }
        fetchedTfs.push(tf.dbTf);
      } catch (e) {
        console.warn(`Tiingo fetch failed for ${tf.dbTf}:`, e);
      }
    }

    // ── Step 2: Calculate indicators & signal PER timeframe ───────────────────
    const signalResults: any[] = [];

    for (const tf of TF_CONFIGS) {
      const rows = await query<{ close: string; timestamp: string }>(
        `SELECT close, timestamp FROM prices WHERE timeframe = ? ORDER BY timestamp DESC LIMIT ?`,
        [tf.dbTf, tf.lookback]
      );

      if (rows.length < tf.minRows) {
        signalResults.push({ tf: tf.dbTf, skipped: true, reason: 'not enough data' });
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

      const [existing] = await query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM signals WHERE timestamp = ? AND timeframe = ?`,
        [signalTs, tf.dbTf]
      );

      if (!existing || existing.cnt === 0) {
        await execute(
          `INSERT INTO signals (timestamp, timeframe, type, strength, price, indicators) VALUES (?, ?, ?, ?, ?, ?)`,
          [signalTs, tf.dbTf, type, strength, latestClose, indicators]
        );
        signalResults.push({ tf: tf.dbTf, inserted: true, type, strength, rsi: rsi.toFixed(2) });
      } else {
        signalResults.push({ tf: tf.dbTf, inserted: false, reason: 'already exists' });
      }
    }

    return NextResponse.json({
      success: true,
      inserted: totalInserted,
      fetchedTfs,
      signals: signalResults,
    });
  } catch (error) {
    console.error('fetch-price error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}