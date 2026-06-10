import { NextRequest, NextResponse } from 'next/server';

const TF_CONFIG: Record<string, { resample: string; days: number }> = {
  '1H':  { resample: '1Hour', days: 7  },
  '4H':  { resample: '4Hour', days: 30 },
  '1D':  { resample: '1Day',  days: 90 },
};

export async function GET(request: NextRequest) {
  const tf = request.nextUrl.searchParams.get('tf') || '1H';
  const config = TF_CONFIG[tf] ?? TF_CONFIG['1H'];

  const startDate = new Date(Date.now() - config.days * 24 * 3600 * 1000)
    .toISOString().split('T')[0];

  const token = process.env.TIINGO_API_KEY;
  const url = `https://api.tiingo.com/tiingo/fx/xauusd/prices?startDate=${startDate}&resampleFreq=${config.resample}&token=${token}`;

  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Tiingo error: ${res.status}` }, { status: 502 });
    }

    const raw = await res.json() as Array<{ date: string; open: number; high: number; low: number; close: number }>;

    const data = raw.map(c => ({
      time: Math.floor(new Date(c.date).getTime() / 1000),
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    }));

    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
