'use client';

import React from 'react';
import { Indicators } from '@/app/lib/types';

interface IndicatorsProps {
  indicators: Indicators | null;
  currentPrice: number;
  loading?: boolean;
}

function GaugeBar({ value, min = 0, max = 100, color }: { value: number; min?: number; max?: number; color: string }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="w-full rounded-full h-1.5 mt-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const CARD = 'rounded-xl p-4 border';
const CARD_STYLE = { background: 'rgba(212,160,23,0.04)', borderColor: 'rgba(212,160,23,0.18)' };

export default function IndicatorsDisplay({ indicators, currentPrice, loading = false }: IndicatorsProps) {
  if (loading && !indicators) {
    return (
      <div className="p-4 space-y-3 h-full" style={{ background: '#0a0a0a' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: 'rgba(212,160,23,0.05)', border: '1px solid rgba(212,160,23,0.1)' }}>
            <div className="h-3 rounded w-1/3 mb-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="h-7 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="h-1.5 rounded mt-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>
        ))}
      </div>
    );
  }

  if (!indicators) {
    return (
      <div className="flex items-center justify-center h-64" style={{ background: '#0a0a0a' }}>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No indicator data</p>
      </div>
    );
  }

  const { rsi, macd, macdSignal, bb } = indicators;
  const macdNum = parseFloat(macd as any);
  const macdSigNum = parseFloat(macdSignal as any);
  const rsiNum = parseFloat(rsi as any);

  const rsiLabel = rsiNum < 30 ? { text: 'Oversold', color: 'text-emerald-400' }
    : rsiNum > 70 ? { text: 'Overbought', color: 'text-red-400' }
    : { text: 'Neutral', color: 'text-amber-400' };

  const macdLabel = macdNum > macdSigNum
    ? { text: 'Bullish', color: 'text-emerald-400' }
    : { text: 'Bearish', color: 'text-red-400' };

  const bbUpper = parseFloat(bb.upper as any);
  const bbMiddle = parseFloat(bb.middle as any);
  const bbLower = parseFloat(bb.lower as any);
  const bbLabel = currentPrice > bbUpper ? { text: 'Above Upper', color: 'text-red-400' }
    : currentPrice < bbLower ? { text: 'Below Lower', color: 'text-emerald-400' }
    : { text: 'Within Bands', color: 'text-amber-400' };

  const muted = 'rgba(255,255,255,0.38)';
  const dim   = 'rgba(255,255,255,0.18)';

  return (
    <div className="p-4 space-y-3 h-full" style={{ background: '#0a0a0a' }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-px h-3" style={{ background: '#D4A017' }} />
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#D4A017' }}>Indicators</p>
      </div>

      {/* RSI */}
      <div className={CARD} style={CARD_STYLE}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium" style={{ color: muted }}>RSI (14)</span>
          <span className={`text-xs font-semibold ${rsiLabel.color}`}>{rsiLabel.text}</span>
        </div>
        <p className="text-2xl font-bold text-white mt-1">{rsiNum.toFixed(1)}</p>
        <GaugeBar
          value={rsiNum}
          color={rsiNum < 30 ? 'bg-emerald-500' : rsiNum > 70 ? 'bg-red-500' : 'bg-amber-500'}
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: dim }}>
          <span>0</span><span>30</span><span>70</span><span>100</span>
        </div>
      </div>

      {/* MACD */}
      <div className={CARD} style={CARD_STYLE}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium" style={{ color: muted }}>MACD</span>
          <span className={`text-xs font-semibold ${macdLabel.color}`}>{macdLabel.text}</span>
        </div>
        <p className={`text-2xl font-bold mt-1 ${macdNum >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {macdNum.toFixed(2)}
        </p>
        <p className="text-xs mt-1" style={{ color: muted }}>Signal: {macdSigNum.toFixed(2)}</p>
        <p className="text-xs" style={{ color: muted }}>Histogram: {(macdNum - macdSigNum).toFixed(2)}</p>
      </div>

      {/* Bollinger Bands */}
      <div className={CARD} style={CARD_STYLE}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium" style={{ color: muted }}>Bollinger Bands</span>
          <span className={`text-xs font-semibold ${bbLabel.color}`}>{bbLabel.text}</span>
        </div>
        <div className="mt-3 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span style={{ color: muted }}>Upper</span>
            <span className="text-red-400 font-mono">{bbUpper.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: muted }}>Middle</span>
            <span className="font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>{bbMiddle.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: muted }}>Lower</span>
            <span className="text-emerald-400 font-mono">{bbLower.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-1.5" style={{ borderTop: '1px solid rgba(212,160,23,0.12)' }}>
            <span style={{ color: muted }}>Width</span>
            <span className="font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>{(bbUpper - bbLower).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
