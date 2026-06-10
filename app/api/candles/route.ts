import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

const TF_MAP: Record<string, { dbTf: string; limit: number }> = {
  '5M': { dbTf: '5m', limit: 288 }, // 1 day × 288 candles
  '1H': { dbTf: '1h', limit: 168 }, // 7 days × 24h
  '4H': { dbTf: '4h', limit: 180 }, // 30 days × 6 candles/day
  '1D': { dbTf: '1d', limit: 90  },
};

export async function GET(request: NextRequest) {
  try {
    const tf = request.nextUrl.searchParams.get('tf') || '1H';
    const config = TF_MAP[tf] ?? TF_MAP['1H'];

    const rows = await query<{ timestamp: string; open: string; high: string; low: string; close: string }>(
      `SELECT timestamp, open, high, low, close FROM prices WHERE timeframe = ? ORDER BY timestamp ASC LIMIT ?`,
      [config.dbTf, config.limit]
    );

    const data = rows.map(r => ({
      time:  Math.floor(new Date(r.timestamp).getTime() / 1000),
      open:  parseFloat(r.open),
      high:  parseFloat(r.high),
      low:   parseFloat(r.low),
      close: parseFloat(r.close),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
