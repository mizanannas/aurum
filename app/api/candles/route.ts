import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

const TF_MAP: Record<string, { dbTf: string; limit: number }> = {
  '5M':  { dbTf: '5m',  limit: 288 },
  '15M': { dbTf: '15m', limit: 480 },
  '30M': { dbTf: '30m', limit: 240 },
  '1H':  { dbTf: '1h',  limit: 168 },
  '4H':  { dbTf: '4h',  limit: 180 },
  '1D':  { dbTf: '1d',  limit: 90  },
  '1W':  { dbTf: '1w',  limit: 104 },
};

export async function GET(request: NextRequest) {
  try {
    const tf = request.nextUrl.searchParams.get('tf') || '1H';
    const config = TF_MAP[tf] ?? TF_MAP['1H'];

    // Ambil N candle TERBARU dulu (DESC), lalu balik ke ASC untuk chart
    const rows = await query<{ timestamp: string; open: string; high: string; low: string; close: string }>(
      `SELECT * FROM (
        SELECT timestamp, open, high, low, close
        FROM prices
        WHERE timeframe = ?
        ORDER BY timestamp DESC
        LIMIT ?
      ) sub ORDER BY timestamp ASC`,
      [config.dbTf, config.limit]
    );

    const data = rows.map(r => ({
      time:  Math.floor(new Date(r.timestamp).getTime() / 1000),
      open:  parseFloat(r.open),
      high:  parseFloat(r.high),
      low:   parseFloat(r.low),
      close: parseFloat(r.close),
    }));

    return NextResponse.json({ success: true, data }, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}