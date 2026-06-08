import axios from 'axios';

const TIINGO_API_KEY = process.env.TIINGO_API_KEY;
const TIINGO_BASE_URL = 'https://api.tiingo.com/tiingo/forex/prices';

export interface TiingoPrice {
  date: string;
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
}

export interface XAUUSDPrice {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetch latest XAUUSD price from Tiingo API
 */
export async function getXAUUSDPrice(): Promise<XAUUSDPrice | null> {
  try {
    if (!TIINGO_API_KEY) {
      throw new Error('TIINGO_API_KEY is not set');
    }

    const response = await axios.get(TIINGO_BASE_URL, {
      params: {
        tickers: 'XAUUSD',
        token: TIINGO_API_KEY,
      },
    });

    if (!response.data || response.data.length === 0) {
      console.warn('No XAUUSD data from Tiingo');
      return null;
    }

    const data = response.data[0];

    // Tiingo returns array, get the latest price
    const latestPrice = Array.isArray(data) ? data[0] : data;

    return {
      timestamp: new Date(latestPrice.date),
      open: latestPrice.open || 0,
      high: latestPrice.high || 0,
      low: latestPrice.low || 0,
      close: latestPrice.close || 0,
      volume: latestPrice.volume || 0,
    };
  } catch (error) {
    console.error('Error fetching XAUUSD price:', error);
    throw error;
  }
}

/**
 * Fetch historical XAUUSD data (last N days)
 */
export async function getXAUUSDHistory(days: number = 30): Promise<XAUUSDPrice[]> {
  try {
    if (!TIINGO_API_KEY) {
      throw new Error('TIINGO_API_KEY is not set');
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const response = await axios.get(TIINGO_BASE_URL, {
      params: {
        tickers: 'XAUUSD',
        token: TIINGO_API_KEY,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    });

    if (!response.data || response.data.length === 0) {
      console.warn('No XAUUSD history from Tiingo');
      return [];
    }

    const data = response.data[0];
    const prices = Array.isArray(data) ? data : [data];

    return prices.map((p: TiingoPrice) => ({
      timestamp: new Date(p.date),
      open: p.open || 0,
      high: p.high || 0,
      low: p.low || 0,
      close: p.close || 0,
      volume: p.volume || 0,
    }));
  } catch (error) {
    console.error('Error fetching XAUUSD history:', error);
    throw error;
  }
}