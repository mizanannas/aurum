'use client';

import type { TechnicalAnalysis } from '@/types';
import { mockTechnical } from '@/lib/mockData';

interface TechnicalSignalsProps {
  data?: TechnicalAnalysis;
}

export default function TechnicalSignals({ data }: TechnicalSignalsProps) {
  const tech = data ?? mockTechnical;

  const signalColor = (signal: string) => {
    if (signal === 'BUY') return 'signal-buy';
    if (signal === 'SELL') return 'signal-sell';
    return 'signal-neutral';
  };

  const signalLabel = (signal: string) => {
    if (signal === 'BUY') return '▲ BUY';
    if (signal === 'SELL') return '▼ SELL';
    return '● NEUTRAL';
  };

  const indicators = [
    tech.rsi,
    tech.macd,
    tech.ema20,
    tech.ema50,
    tech.bb,
    tech.atr,
  ];

  const totalSignals = tech.buyCount + tech.sellCount + tech.neutralCount;
  const buyPct = (tech.buyCount / totalSignals) * 100;
  const sellPct = (tech.sellCount / totalSignals) * 100;

  return (
    <div className="panel signals-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="title-icon">⚡</span>
          <span>Technical Signals</span>
        </div>
        <div className={`overall-badge ${signalColor(tech.overallSignal)}`}>
          {tech.overallStrength} {tech.overallSignal}
        </div>
      </div>

      {/* Summary bar */}
      <div className="signal-summary">
        <div className="summary-counts">
          <span className="count-buy">{tech.buyCount} BUY</span>
          <span className="count-neutral">{tech.neutralCount} NEUTRAL</span>
          <span className="count-sell">{tech.sellCount} SELL</span>
        </div>
        <div className="summary-bar">
          <div className="bar-buy" style={{ width: `${buyPct}%` }} />
          <div className="bar-neutral" style={{ width: `${(tech.neutralCount / totalSignals) * 100}%` }} />
          <div className="bar-sell" style={{ width: `${sellPct}%` }} />
        </div>
      </div>

      {/* Indicator list */}
      <div className="indicators-list">
        {indicators.map((ind) => (
          <div key={ind.name} className="indicator-row">
            <div className="ind-left">
              <span className="ind-name">{ind.name}</span>
              <span className="ind-desc">{ind.description}</span>
            </div>
            <div className="ind-right">
              <span className="ind-value">{ind.value.toFixed(2)}</span>
              <span className={`ind-signal ${signalColor(ind.signal)}`}>
                {signalLabel(ind.signal)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
