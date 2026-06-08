// TypeScript Types for Aurum

export interface Price {
  id: number;
  timestamp: Date;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  created_at: Date;
}

export interface Signal {
  id: number;
  timestamp: Date;
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
  price: number;
  indicators: {
    rsi?: number;
    macd?: number;
    macdSignal?: number;
    bb?: {
      upper: number;
      middle: number;
      lower: number;
    };
  };
  created_at: Date;
}

export interface Indicators {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bb: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export interface ChartData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}