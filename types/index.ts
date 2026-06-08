export interface PriceTick {
  time: number; // unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CurrentPrice {
  price: number;
  change: number;
  changePct: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export type SignalDirection = 'BUY' | 'SELL' | 'NEUTRAL';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';

export interface TechnicalSignal {
  name: string;
  value: number;
  signal: SignalDirection;
  description: string;
}

export interface TechnicalAnalysis {
  rsi: TechnicalSignal;
  macd: TechnicalSignal;
  ema20: TechnicalSignal;
  ema50: TechnicalSignal;
  bb: TechnicalSignal;
  atr: TechnicalSignal;
  overallSignal: SignalDirection;
  overallStrength: SignalStrength;
  buyCount: number;
  sellCount: number;
  neutralCount: number;
}

export interface SentimentData {
  score: number; // -1 to 1
  label: 'VERY_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'VERY_BULLISH';
  newsItems: NewsItem[];
  updatedAt: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  sentiment: SignalDirection;
  sentimentScore: number;
  publishedAt: number;
  url: string;
}

export interface Prediction {
  position: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  targetPrice: number;
  stopLoss: number;
  timeframe: string;
  reasoning: string[];
  updatedAt: number;
}
// Tambahkan di paling bawah file index.ts/types kamu
export interface TrendForecastItem {
  period: string;
  direction: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  confidence: number;
  conviction: 'High Conviction' | 'Mid Conviction' | 'Low Conviction';
}

export interface DynamicRange {
  highest: number;
  lowest: number;
}

export interface TradeLog {
  timestamp: string;
  category: 'System' | 'AI Engine' | 'Price Feed' | 'User';
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}