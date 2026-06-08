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
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
}

// ── Signal logic ──────────────────────────────────────────────────────────────

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

  let type: 'BUY' | 'SELL' | 'HOLD';
  if (score >= 65) type = 'BUY';
  else if (score <= 35) type = 'SELL';
  else type = 'HOLD';

  return { type, strength: score };
}

// ── Tiingo fetch ──────────────────────────────────────────────────────────────

async function fetchTiingo(startDate: string) {
  const token = process.env.TIINGO_API_KEY;
  const url = `https://api.tiingo.com/tiingo/fx/xauusd/prices?startDate=${startDate}&resampleFreq=1Hour&token=${token}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`Tiingo error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<Array<{ date: string; open: number; high: number; low: number; close: number }>>;
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Return current DB state (same as /api/prices GET)
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
    // Remove duplicate signals — keep only highest id per timestamp
    await execute(
      `DELETE s1 FROM signals s1
       INNER JOIN signals s2
       WHERE s1.timestamp = s2.timestamp AND s1.id < s2.id`
    );

    // Determine start date: fetch last 100 hours or since last stored price
    const [lastRow] = await query<{ ts: string }>(
      `SELECT DATE_FORMAT(MAX(timestamp), '%Y-%m-%d') as ts FROM prices`
    );
    const lastDate = lastRow?.ts;

    // Always go back at least 7 days to have enough data for indicators
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const startDate = lastDate && new Date(lastDate) > sevenDaysAgo
      ? lastDate
      : sevenDaysAgo.toISOString().split('T')[0];

    const candles = await fetchTiingo(startDate);

    if (!candles || candles.length === 0) {
      return NextResponse.json({ success: false, error: 'No data from Tiingo' }, { status: 502 });
    }

    // Insert prices (ignore duplicates via INSERT IGNORE on unique timestamp)
    let inserted = 0;
    for (const c of candles) {
      const ts = new Date(c.date).toISOString().slice(0, 19).replace('T', ' ');
      try {
        await execute(
          `INSERT IGNORE INTO prices (timestamp, timeframe, open, high, low, close, volume) VALUES (?, '1h', ?, ?, ?, ?, 0)`,
          [ts, c.open, c.high, c.low, c.close]
        );
        inserted++;
      } catch (_) { /* skip duplicate */ }
    }

    // Load enough closes to calculate all indicators
    const rows = await query<{ close: string; timestamp: string; high: string; low: string }>(
      `SELECT close, high, low, timestamp FROM prices WHERE timeframe = '1h' ORDER BY timestamp DESC LIMIT 60`
    );

    if (rows.length < 30) {
      return NextResponse.json({ success: true, message: `Inserted ${inserted} candles. Not enough data for signals yet.` });
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

    // Only insert if no signal exists for this exact hour yet
    const [existing] = await query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM signals WHERE timestamp = ?`,
      [signalTs]
    );
    let signalInserted = false;
    if (!existing || existing.cnt === 0) {
      await execute(
        `INSERT INTO signals (timestamp, type, strength, price, indicators) VALUES (?, ?, ?, ?, ?)`,
        [signalTs, type, strength, latestClose, indicators]
      );
      signalInserted = true;
    }

    return NextResponse.json({
      success: true,
      inserted,
      signalInserted,
      signal: { type, strength, price: latestClose, rsi: rsi.toFixed(2), macd: macd.toFixed(4) },
    });
  } catch (error) {
    console.error('fetch-price error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
