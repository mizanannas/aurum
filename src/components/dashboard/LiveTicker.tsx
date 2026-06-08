'use client';

import { useEffect, useState } from 'react';
import type { CurrentPrice } from '@/types';
import { mockCurrentPrice } from '@/lib/mockData';

interface LiveTickerProps {
  data?: CurrentPrice;
}

export default function LiveTicker({ data }: LiveTickerProps) {
  const [price, setPrice] = useState<CurrentPrice>(data ?? mockCurrentPrice);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Simulate live price ticks
    const interval = setInterval(() => {
      setPrice((prev) => {
        const delta = (Math.random() - 0.495) * 0.8;
        const newPrice = +(prev.price + delta).toFixed(2);
        const change = +(newPrice - 3315.15).toFixed(2);
        setFlash(delta > 0 ? 'up' : 'down');
        setTimeout(() => setFlash(null), 400);
        return {
          ...prev,
          price: newPrice,
          change,
          changePct: +((change / 3315.15) * 100).toFixed(3),
          timestamp: Date.now(),
        };
      });
    }, 1500);

    const clock = setInterval(() => setNow(new Date()), 1000);

    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
  }, []);

  const isPositive = price.change >= 0;

  return (
    <div className="ticker-bar">
      <div className="ticker-left">
        <div className="ticker-symbol">
          <span className="symbol-text">XAU<span className="symbol-usd">/USD</span></span>
          <span className="live-badge">● LIVE</span>
        </div>
        <div className={`ticker-price ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}>
          {price.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`ticker-change ${isPositive ? 'positive' : 'negative'}`}>
          <span>{isPositive ? '▲' : '▼'}</span>
          <span>{isPositive ? '+' : ''}{price.change.toFixed(2)}</span>
          <span>({isPositive ? '+' : ''}{price.changePct.toFixed(3)}%)</span>
        </div>
      </div>

      <div className="ticker-stats">
        <div className="stat-item">
          <span className="stat-label">24H HIGH</span>
          <span className="stat-value high">{price.high24h.toLocaleString()}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">24H LOW</span>
          <span className="stat-value low">{price.low24h.toLocaleString()}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">SPREAD</span>
          <span className="stat-value">0.30</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">SERVER TIME</span>
          <span className="stat-value">{now.toUTCString().slice(17, 25)} UTC</span>
        </div>
      </div>
    </div>
  );
}
