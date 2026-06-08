import type {
  CurrentPrice,
  PriceTick,
  TechnicalAnalysis,
  SentimentData,
  Prediction,
} from '@/types';

// Generate realistic XAUUSD OHLCV candles
export function generateMockCandles(count = 120): PriceTick[] {
  const candles: PriceTick[] = [];
  let price = 3320;
  const now = Math.floor(Date.now() / 1000);

  for (let i = count; i >= 0; i--) {
    const volatility = price * 0.003;
    const open = price;
    const change = (Math.random() - 0.49) * volatility;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    candles.push({
      time: now - i * 900, // 15min candles
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(Math.random() * 5000 + 1000),
    });

    price = close;
  }
  return candles;
}

export const mockCurrentPrice: CurrentPrice = {
  price: 3327.45,
  change: 12.3,
  changePct: 0.37,
  high24h: 3341.2,
  low24h: 3298.8,
  timestamp: Date.now(),
};

export const mockTechnical: TechnicalAnalysis = {
  rsi: {
    name: 'RSI (14)',
    value: 58.4,
    signal: 'NEUTRAL',
    description: 'Approaching overbought zone',
  },
  macd: {
    name: 'MACD',
    value: 4.2,
    signal: 'BUY',
    description: 'Bullish crossover confirmed',
  },
  ema20: {
    name: 'EMA 20',
    value: 3318.5,
    signal: 'BUY',
    description: 'Price above EMA20',
  },
  ema50: {
    name: 'EMA 50',
    value: 3305.1,
    signal: 'BUY',
    description: 'Price above EMA50',
  },
  bb: {
    name: 'Bollinger Bands',
    value: 0.62,
    signal: 'NEUTRAL',
    description: 'Price near upper band',
  },
  atr: {
    name: 'ATR (14)',
    value: 18.7,
    signal: 'NEUTRAL',
    description: 'High volatility environment',
  },
  overallSignal: 'BUY',
  overallStrength: 'MODERATE',
  buyCount: 3,
  sellCount: 0,
  neutralCount: 3,
};

export const mockSentiment: SentimentData = {
  score: 0.42,
  label: 'BULLISH',
  newsItems: [
    {
      id: '1',
      title: 'Fed signals potential rate cuts amid inflation concerns',
      source: 'Reuters',
      sentiment: 'BUY',
      sentimentScore: 0.78,
      publishedAt: Date.now() - 1800000,
      url: '#',
    },
    {
      id: '2',
      title: 'Dollar weakens as safe-haven demand for gold rises',
      source: 'Bloomberg',
      sentiment: 'BUY',
      sentimentScore: 0.65,
      publishedAt: Date.now() - 3600000,
      url: '#',
    },
    {
      id: '3',
      title: 'Middle East tensions boost precious metals market',
      source: 'CNBC',
      sentiment: 'BUY',
      sentimentScore: 0.55,
      publishedAt: Date.now() - 7200000,
      url: '#',
    },
    {
      id: '4',
      title: 'Strong US jobs data may limit gold upside',
      source: 'FT',
      sentiment: 'SELL',
      sentimentScore: -0.4,
      publishedAt: Date.now() - 10800000,
      url: '#',
    },
    {
      id: '5',
      title: 'Central banks continue gold accumulation in Q2',
      source: 'WGC',
      sentiment: 'BUY',
      sentimentScore: 0.82,
      publishedAt: Date.now() - 14400000,
      url: '#',
    },
  ],
  updatedAt: Date.now(),
};

export const mockPrediction: Prediction = {
  position: 'BUY',
  confidence: 72,
  targetPrice: 3365.0,
  stopLoss: 3298.0,
  timeframe: '4H',
  reasoning: [
    'EMA20/50 bullish crossover confirmed',
    'MACD histogram expanding positively',
    'News sentiment strongly bullish (0.42)',
    'Price holding above key $3,300 support',
  ],
  updatedAt: Date.now(),
};
