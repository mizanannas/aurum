import { Indicators, Signal } from './types';
import { Price } from './types';
import { calculateAllIndicators, checkLevelBreakout } from './indicators';

/**
 * Generate trading signal based on indicators
 */
export function generateSignal(
  price: Price,
  indicators: Indicators
): Omit<Signal, 'id' | 'created_at' | 'timestamp'> {
  let type: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let strength: number = 50;

  const { rsi, macd, bb } = indicators;

  // RSI-based signals
  if (rsi < 30) {
    type = 'BUY';
    strength = Math.min(100, 70 + (30 - rsi) / 3); // Higher when deeply oversold
  } else if (rsi > 70) {
    type = 'SELL';
    strength = Math.min(100, 70 + (rsi - 70) / 3); // Higher when deeply overbought
  }

  // MACD confirmation
  if (macd > 0 && type === 'HOLD') {
    type = 'BUY';
    strength = 60;
  } else if (macd < 0 && type === 'HOLD') {
    type = 'SELL';
    strength = 60;
  }

  // Bollinger Bands confirmation
  if (price.close < bb.lower && type === 'BUY') {
    strength = Math.min(100, strength + 20); // Strengthen BUY signal
  } else if (price.close > bb.upper && type === 'SELL') {
    strength = Math.min(100, strength + 20); // Strengthen SELL signal
  }

  // Price near middle band = weak signal
  if (Math.abs(price.close - bb.middle) < (bb.upper - bb.lower) * 0.1) {
    strength = Math.max(30, strength - 20);
  }

  return {
    type,
    strength: Math.round(strength),
    price: price.close,
    indicators: {
      rsi,
      macd,
      bb,
    },
  };
}

/**
 * Generate signal from price array
 */
export function generateSignalFromPrices(
  prices: Price[]
): Omit<Signal, 'id' | 'created_at' | 'timestamp'> {
  if (prices.length === 0) {
    return {
      type: 'HOLD',
      strength: 50,
      price: 0,
      indicators: {
        rsi: 50,
        macd: 0,
        bb: {
          upper: 0,
          middle: 0,
          lower: 0,
        },
      },
    };
  }

  const latestPrice = prices[prices.length - 1];
  const indicators = calculateAllIndicators(prices);

  return generateSignal(latestPrice, indicators);
}

/**
 * Analyze signal confidence
 */
export function analyzeSignalConfidence(
  signal: Omit<Signal, 'id' | 'created_at' | 'timestamp'>
): {
  isValid: boolean;
  reason: string;
  confidence: number;
} {
  if (signal.strength < 40) {
    return {
      isValid: false,
      reason: 'Signal strength too weak',
      confidence: signal.strength,
    };
  }

  if (signal.type === 'HOLD') {
    return {
      isValid: false,
      reason: 'No clear direction',
      confidence: 0,
    };
  }

  // Valid signal
  return {
    isValid: true,
    reason: `${signal.type} signal with ${signal.strength}% strength`,
    confidence: signal.strength,
  };
}

/**
 * Get signal recommendations
 */
export function getSignalRecommendation(signal: Omit<Signal, 'id' | 'created_at' | 'timestamp'>): {
  action: 'BUY' | 'SELL' | 'WAIT';
  reason: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
} {
  if (signal.strength < 50) {
    return {
      action: 'WAIT',
      reason: 'Wait for stronger signals',
      riskLevel: 'LOW',
    };
  }

  if (signal.strength > 80) {
    return {
      action: signal.type === 'BUY' ? 'BUY' : 'SELL',
      reason: `Strong ${signal.type} signal detected`,
      riskLevel: 'LOW',
    };
  }

  if (signal.strength > 60) {
    return {
      action: signal.type === 'BUY' ? 'BUY' : 'SELL',
      reason: `Moderate ${signal.type} signal`,
      riskLevel: 'MEDIUM',
    };
  }

  return {
    action: 'WAIT',
    reason: 'Unclear signal, wait for confirmation',
    riskLevel: 'MEDIUM',
  };
}

/**
 * Signal filter - avoid false signals
 */
export function filterFalseSignals(
  currentSignal: Omit<Signal, 'id' | 'created_at' | 'timestamp'>,
  previousSignal?: Omit<Signal, 'id' | 'created_at' | 'timestamp'>
): boolean {
  // If no previous signal, accept current
  if (!previousSignal) {
    return true;
  }

  // Don't allow signal reversal too quickly
  if (currentSignal.type !== previousSignal.type && currentSignal.strength < 70) {
    return false;
  }

  // Accept if strength increased
  if (currentSignal.strength > previousSignal.strength) {
    return true;
  }

  return true;
}