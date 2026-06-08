import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { Price, ApiResponse } from '@/app/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const timeframe = searchParams.get('timeframe') || '1h';

    if (limit > 500) {
      return NextResponse.json(
        {
          success: false,
          error: 'Limit cannot exceed 500',
        },
        { status: 400 }
      );
    }

    // Query prices
    const prices = await query<Price>(
      `SELECT * FROM prices 
       WHERE timeframe = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [timeframe, limit]
    );

    // Reverse to get chronological order
    const chronological = prices.reverse();

    // Convert to chart format (timestamp in seconds)
    const chartData = chronological.map((p) => ({
      time: Math.floor(new Date(p.timestamp).getTime() / 1000),
      open: parseFloat(p.open.toString()),
      high: parseFloat(p.high.toString()),
      low: parseFloat(p.low.toString()),
      close: parseFloat(p.close.toString()),
      volume: p.volume,
    }));

    return NextResponse.json(
      {
        success: true,
        data: chartData,
        count: chartData.length,
      } as ApiResponse<typeof chartData>,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST endpoint to test/debug
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sql, params } = body;

    if (!sql) {
      return NextResponse.json(
        {
          success: false,
          error: 'SQL query required',
        },
        { status: 400 }
      );
    }

    const results = await query<any>(sql, params);

    return NextResponse.json(
      {
        success: true,
        data: results,
        count: results.length,
      },
      { status: 200 }
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