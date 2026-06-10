import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { Signal, ApiResponse } from '@/app/lib/types';

const VALID_TF = ['5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const;
const TF_MAP: Record<string, string> = {
  '5M': '5m', '15M': '15m', '30M': '30m', '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w',
  '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w',
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const typeFilter = searchParams.get('type');
    // Accept both "1H" (frontend) and "1h" (db) format
    const tfRaw = searchParams.get('timeframe') || searchParams.get('tf') || '1h';
    const timeframe = TF_MAP[tfRaw] ?? tfRaw.toLowerCase();
    console.log(`[signals] tfRaw=${tfRaw} timeframe=${timeframe}`);

    if (limit > 200) {
      return NextResponse.json({ success: false, error: 'Limit cannot exceed 200' }, { status: 400 });
    }

    const params: any[] = [timeframe];
    let sql = `SELECT * FROM signals WHERE timeframe = ?`;

    if (typeFilter && ['BUY', 'SELL', 'HOLD'].includes(typeFilter)) {
      sql += ` AND type = ?`;
      params.push(typeFilter);
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const signals = await query<Signal>(sql, params);
    const chronological = signals.reverse();

    const formatted = chronological.map((signal) => ({
      id: signal.id,
      timestamp: signal.timestamp,
      type: signal.type,
      strength: signal.strength,
      price: signal.price,
      timeframe: (signal as any).timeframe ?? timeframe,
      indicators: typeof signal.indicators === 'string'
        ? JSON.parse(signal.indicators)
        : signal.indicators,
      created_at: signal.created_at,
    }));

    return NextResponse.json(
      { success: true, data: formatted, count: formatted.length } as ApiResponse<typeof formatted>,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching signals:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'stats') {
      const stats = await query<any>(
        `SELECT timeframe, type, COUNT(*) as count, AVG(strength) as avg_strength
         FROM signals GROUP BY timeframe, type ORDER BY timeframe, type`
      );
      return NextResponse.json({ success: true, data: stats }, { status: 200 });
    }

    if (action === 'latest') {
      const tfRaw = body.timeframe ?? '1h';
      const timeframe = TF_MAP[tfRaw] ?? tfRaw.toLowerCase();
    console.log(`[signals] tfRaw=${tfRaw} timeframe=${timeframe}`);
      const signals = await query<Signal>(
        `SELECT * FROM signals WHERE timeframe = ? ORDER BY timestamp DESC LIMIT 1`,
        [timeframe]
      );
      if (signals.length === 0) {
        return NextResponse.json({ success: false, error: 'No signals found' }, { status: 404 });
      }
      const signal = signals[0];
      return NextResponse.json({
        success: true,
        data: {
          ...signal,
          indicators: typeof signal.indicators === 'string'
            ? JSON.parse(signal.indicators)
            : signal.indicators,
        },
      }, { status: 200 });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}