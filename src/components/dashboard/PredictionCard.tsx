'use client';

import type { Prediction } from '@/types';
import { mockPrediction } from '@/lib/mockData';

interface PredictionCardProps {
  data?: Prediction;
  currentPrice?: number;
}

export default function PredictionCard({ data, currentPrice = 3327.45 }: PredictionCardProps) {
  const pred = data ?? mockPrediction;

  const isBuy = pred.position === 'BUY';
  const isSell = pred.position === 'SELL';
  const isHold = pred.position === 'HOLD';

  const posColor = isBuy ? '#22d3a5' : isSell ? '#f45c6e' : '#f0c040';
  const rrRatio = Math.abs(pred.targetPrice - currentPrice) / Math.abs(currentPrice - pred.stopLoss);

  const potential = isBuy
    ? pred.targetPrice - currentPrice
    : currentPrice - pred.targetPrice;

  const risk = Math.abs(currentPrice - pred.stopLoss);

  return (
    <div className="panel prediction-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="title-icon">🤖</span>
          <span>AI Prediction</span>
        </div>
        <span className="panel-subtitle">{pred.timeframe} Timeframe</span>
      </div>

      {/* Main position */}
      <div className="prediction-main">
        <div className="position-badge" style={{ borderColor: posColor, color: posColor }}>
          <span className="pos-icon">
            {isBuy ? '▲' : isSell ? '▼' : '◆'}
          </span>
          <span className="pos-label">{pred.position}</span>
        </div>

        <div className="confidence-wrap">
          <div className="confidence-label">Confidence</div>
          <div className="confidence-bar-wrap">
            <div
              className="confidence-bar-fill"
              style={{ width: `${pred.confidence}%`, background: posColor }}
            />
          </div>
          <div className="confidence-pct" style={{ color: posColor }}>{pred.confidence}%</div>
        </div>
      </div>

      {/* Price levels */}
      <div className="price-levels">
        <div className="level-item">
          <span className="level-label">ENTRY</span>
          <span className="level-value current">${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="level-item">
          <span className="level-label">TARGET</span>
          <span className="level-value target" style={{ color: '#22d3a5' }}>
            ${pred.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="level-diff positive">+${potential.toFixed(2)}</span>
        </div>
        <div className="level-item">
          <span className="level-label">STOP LOSS</span>
          <span className="level-value stoploss" style={{ color: '#f45c6e' }}>
            ${pred.stopLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="level-diff negative">-${risk.toFixed(2)}</span>
        </div>
        <div className="level-item rr-item">
          <span className="level-label">R:R RATIO</span>
          <span className="level-value rr" style={{ color: '#f0c040' }}>1 : {rrRatio.toFixed(2)}</span>
        </div>
      </div>

      {/* Reasoning */}
      <div className="reasoning-section">
        <div className="reasoning-title">Signal Basis</div>
        <ul className="reasoning-list">
          {pred.reasoning.map((r, i) => (
            <li key={i} className="reasoning-item">
              <span className="reasoning-dot" style={{ background: posColor }} />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="pred-disclaimer">
        ⚠️ For educational purposes only. Not financial advice.
      </div>
    </div>
  );
}
