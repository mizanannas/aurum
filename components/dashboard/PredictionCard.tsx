'use client';

import { useState } from 'react';
import { mockTrendForecast, mockDynamicRange, mockTradeLogs } from '@/lib/mockData';

export default function PredictionCard() {
  const [lotSize, setLotSize] = useState('0.10');
  const [tradeType, setTradeType] = useState('BUY');
  const [logs, setLogs] = useState(mockTradeLogs);

  const handleExecuteLog = () => {
    const now = new Date();
    const timeStr = `[${now.toTimeString().slice(0, 8)}]`;
    const newLog = {
      timestamp: timeStr,
      category: 'User' as const,
      message: `Lot ${lotSize} | ${tradeType} @ $3,327.45`,
      type: 'info' as const
    };
    const successLog = {
      timestamp: timeStr,
      category: 'System' as const,
      message: 'Log position executed successfully',
      type: 'warning' as const
    };
    setLogs((prev) => [...prev, newLog, successLog]);
  };

  return (
    <div className="prediction-column-wrapper">
      
      {/* PANEL C: AI PREDICTIVE INTELLIGENCE */}
      <div className="panel predictive-intelligence-panel">
        <div className="panel-header">
          <div className="panel-title">
            <span className="title-icon">⭐</span>
            <span>PANEL C: AI PREDICTIVE INTELLIGENCE</span>
          </div>
        </div>

        {/* Strong Buy Status Header */}
        <div className="status-main-box">
          <div className="brain-glow-icon">🟢</div>
          <div className="status-info">
            <div className="status-title-text text-buy">STRONG BUY</div>
            <div className="status-confidence">(Confidence: 89%)</div>
          </div>
        </div>

        {/* Trend Projection */}
        <div className="sub-section-forecast">
          <div className="section-subtitle">📅 TREND PROJECTION (Multi-Day Forecast)</div>
          <div className="forecast-list">
            {mockTrendForecast.map((item, idx) => (
              <div key={idx} className="forecast-row">
                <span className="forecast-period">{item.period}</span>
                <span className="forecast-divider">:</span>
                <div className="forecast-values">
                  <span className={`direction-badge ${item.direction.toLowerCase()}`}>
                    {item.direction === 'BULLISH' ? '↗ BULLISH' : '➔ SIDEWAYS'}
                  </span>
                  <span className={`conviction-tag ${item.direction.toLowerCase()}`}>
                    ({item.conviction})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Volatility Range */}
        <div className="sub-section-range">
          <div className="section-subtitle">📊 DYNAMIC VOLATILITY RANGE (Batas Atas/Bawah)</div>
          <div className="range-box-container">
            <div className="range-row">
              <span className="range-label">• Projected HIGHEST (This Week)</span>
              <span className="range-divider">:</span>
              <span className="range-value text-buy">${mockDynamicRange.highest.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="range-row">
              <span className="range-label">• Projected LOWEST (This Week)</span>
              <span className="range-divider">:</span>
              <span className="range-value text-sell">${mockDynamicRange.lowest.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL D: MANUAL TRADE JOURNAL & LOG BOX */}
      <div className="panel manual-journal-panel">
        <div className="panel-header">
          <div className="panel-title">
            <span className="title-icon">📄</span>
            <span>PANEL D: MANUAL TRADE JOURNAL & LOG BOX</span>
          </div>
        </div>

        {/* Inputs */}
        <div className="journal-inputs-row">
          <div className="input-item">
            <label>Lot:</label>
            <input 
              type="text" 
              value={lotSize} 
              onChange={(e) => setLotSize(e.target.value)} 
              className="journal-input"
            />
          </div>
          <div className="input-item">
            <label>Type:</label>
            <select 
              value={tradeType} 
              onChange={(e) => setTradeType(e.target.value)} 
              className="journal-select"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
          <div className="input-item">
            <label>Price:</label>
            <span className="static-price-box">$3,327.45</span>
          </div>
        </div>

        {/* Action Button */}
        <button onClick={handleExecuteLog} className="execute-btn">
          ⚡ EXECUTE LOG POSITION
        </button>

        {/* Terminal Logger */}
        <div className="terminal-log-container">
          <div className="terminal-scroller">
            {logs.map((log, idx) => (
              <div key={idx} className="terminal-line">
                <span className="log-time">{log.timestamp}</span>
                <span className="log-cat">{log.category}</span>
                <span className={`log-msg ${log.type === 'success' ? 'msg-success' : log.type === 'warning' ? 'msg-warning' : ''}`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}