import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { Signal, ApiResponse } from '@/app/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type'); // BUY, SELL, HOLD

    if (limit > 200) {
      return NextResponse.json(
        {
          success: false,
          error: 'Limit cannot exceed 200',
        },
        { status: 400 }
      );
    }

    let sql = `SELECT * FROM signals`;
    const params: any[] = [];

    if (type && ['BUY', 'SELL', 'HOLD'].includes(type)) {
      sql += ` WHERE type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const signals = await query<Signal>(sql, params);

    // Reverse to get chronological order
    const chronological = signals.reverse();

    // Format response
    const formatted = chronological.map((signal) => ({
      id: signal.id,
      timestamp: signal.timestamp,
      type: signal.type,
      strength: signal.strength,
      price: signal.price,
      indicators: typeof signal.indicators === 'string' 
        ? JSON.parse(signal.indicators) 
        : signal.indicators,
      created_at: signal.created_at,
    }));

    return NextResponse.json(
      {
        success: true,
        data: formatted,
        count: formatted.length,
      } as ApiResponse<typeof formatted>,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching signals:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Get signal statistics
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'stats') {
      // Count signals by type
      const stats = await query<any>(
        `SELECT type, COUNT(*) as count, AVG(strength) as avg_strength 
         FROM signals 
         GROUP BY type`
      );

      return NextResponse.json(
        {
          success: true,
          data: stats,
        },
        { status: 200 }
      );
    }

    // Latest signal
    if (action === 'latest') {
      const signals = await query<Signal>(
        `SELECT * FROM signals ORDER BY timestamp DESC LIMIT 1`
      );

      if (signals.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No signals found',
          },
          { status: 404 }
        );
      }

      const signal = signals[0];
      return NextResponse.json(
        {
          success: true,
          data: {
            ...signal,
            indicators: typeof signal.indicators === 'string'
              ? JSON.parse(signal.indicators)
              : signal.indicators,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unknown action',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}