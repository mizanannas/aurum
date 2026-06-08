'use client';

import type { SentimentData } from '@/types';
import { mockSentiment } from '@/lib/mockData';

interface SentimentMeterProps {
  data?: SentimentData;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

export default function SentimentMeter({ data }: SentimentMeterProps) {
  const sentiment = data ?? mockSentiment;

  // score: -1 (very bearish) to 1 (very bullish)
  // Map to 0-180 degrees for gauge
  const angle = ((sentiment.score + 1) / 2) * 180;

  const labelColor = {
    VERY_BEARISH: '#f45c6e',
    BEARISH: '#ff9057',
    NEUTRAL: '#8892a4',
    BULLISH: '#22d3a5',
    VERY_BULLISH: '#00ff9f',
  }[sentiment.label];

  const labelText = sentiment.label.replace('_', ' ');

  // Gauge SVG arcs
  const gaugeRadius = 70;
  const cx = 100;
  const cy = 90;

  const polarToXY = (angleDeg: number, r: number) => {
    const rad = ((angleDeg - 180) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const needlePos = polarToXY(angle, gaugeRadius - 10);

  return (
    <div className="panel sentiment-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="title-icon">🌡️</span>
          <span>Market Sentiment</span>
        </div>
        <span className="updated-label">Updated {timeAgo(sentiment.updatedAt)}</span>
      </div>

      {/* Gauge */}
      <div className="gauge-wrap">
        <svg viewBox="0 0 200 110" className="gauge-svg">
          {/* Background arc segments */}
          {[
            { color: '#f45c6e', start: 0, end: 36 },
            { color: '#ff9057', start: 36, end: 72 },
            { color: '#8892a4', start: 72, end: 108 },
            { color: '#22d3a5', start: 108, end: 144 },
            { color: '#00ff9f', start: 144, end: 180 },
          ].map((seg, i) => {
            const s = polarToXY(seg.start, gaugeRadius);
            const e = polarToXY(seg.end, gaugeRadius);
            const largeArc = seg.end - seg.start > 90 ? 1 : 0;
            return (
              <path
                key={i}
                d={`M ${s.x} ${s.y} A ${gaugeRadius} ${gaugeRadius} 0 ${largeArc} 1 ${e.x} ${e.y}`}
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeLinecap="butt"
                opacity="0.25"
              />
            );
          })}

          {/* Active arc */}
          {(() => {
            const s = polarToXY(0, gaugeRadius);
            const e = polarToXY(angle, gaugeRadius);
            const largeArc = angle > 90 ? 1 : 0;
            return (
              <path
                d={`M ${s.x} ${s.y} A ${gaugeRadius} ${gaugeRadius} 0 ${largeArc} 1 ${e.x} ${e.y}`}
                fill="none"
                stroke={labelColor}
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.9"
              />
            );
          })()}

          {/* Needle */}
          <line
            x1={cx}
            y1={cy}
            x2={needlePos.x}
            y2={needlePos.y}
            stroke={labelColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="5" fill={labelColor} />

          {/* Labels */}
          <text x="16" y="100" fill="#f45c6e" fontSize="8" opacity="0.7">BEAR</text>
          <text x="88" y="18" fill="#8892a4" fontSize="8" opacity="0.7">NEU</text>
          <text x="170" y="100" fill="#22d3a5" fontSize="8" opacity="0.7">BULL</text>
        </svg>

        <div className="gauge-label-wrap">
          <span className="gauge-score" style={{ color: labelColor }}>
            {sentiment.score > 0 ? '+' : ''}{(sentiment.score * 100).toFixed(0)}
          </span>
          <span className="gauge-label" style={{ color: labelColor }}>{labelText}</span>
        </div>
      </div>

      {/* News feed */}
      <div className="news-feed">
        <div className="news-feed-title">Latest News</div>
        {sentiment.newsItems.map((item) => (
          <div key={item.id} className="news-item">
            <div className="news-meta">
              <span className={`news-signal ${item.sentiment === 'BUY' ? 'signal-buy' : item.sentiment === 'SELL' ? 'signal-sell' : 'signal-neutral'}`}>
                {item.sentiment === 'BUY' ? '▲' : item.sentiment === 'SELL' ? '▼' : '●'}
              </span>
              <span className="news-source">{item.source}</span>
              <span className="news-time">{timeAgo(item.publishedAt)}</span>
            </div>
            <p className="news-title">{item.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
