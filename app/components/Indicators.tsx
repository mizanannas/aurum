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
    <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function IndicatorsDisplay({ indicators, currentPrice, loading = false }: IndicatorsProps) {
  if (loading && !indicators) {
    return (
      <div className="p-4 space-y-4 bg-slate-950 h-full">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-slate-900 rounded-lg p-4 animate-pulse">
            <div className="h-3 bg-slate-700 rounded w-1/3 mb-3"></div>
            <div className="h-7 bg-slate-700 rounded w-1/2"></div>
            <div className="h-1.5 bg-slate-700 rounded mt-3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!indicators) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-950">
        <p className="text-slate-500 text-sm">No indicator data</p>
      </div>
    );
  }

  const { rsi, macd, macdSignal, bb } = indicators;
  const macdNum = parseFloat(macd as any);
  const macdSigNum = parseFloat(macdSignal as any);
  const rsiNum = parseFloat(rsi as any);

  const rsiLabel = rsiNum < 30 ? { text: 'Oversold', color: 'text-emerald-400' }
    : rsiNum > 70 ? { text: 'Overbought', color: 'text-red-400' }
    : { text: 'Neutral', color: 'text-slate-400' };

  const macdLabel = macdNum > macdSigNum
    ? { text: 'Bullish', color: 'text-emerald-400' }
    : { text: 'Bearish', color: 'text-red-400' };

  const bbUpper = parseFloat(bb.upper as any);
  const bbMiddle = parseFloat(bb.middle as any);
  const bbLower = parseFloat(bb.lower as any);
  const bbLabel = currentPrice > bbUpper ? { text: 'Above Upper', color: 'text-red-400' }
    : currentPrice < bbLower ? { text: 'Below Lower', color: 'text-emerald-400' }
    : { text: 'Within Bands', color: 'text-slate-400' };

  return (
    <div className="bg-slate-950 p-4 space-y-3 h-full">
      <p className="text-xs text-slate-500 uppercase tracking-wider">Indicators</p>

      {/* RSI */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">RSI (14)</span>
          <span className={`text-xs font-medium ${rsiLabel.color}`}>{rsiLabel.text}</span>
        </div>
        <p className="text-2xl font-bold text-white mt-1">{rsiNum.toFixed(1)}</p>
        <GaugeBar value={rsiNum} color={rsiNum < 30 ? 'bg-emerald-500' : rsiNum > 70 ? 'bg-red-500' : 'bg-blue-500'} />
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>0</span><span>30</span><span>70</span><span>100</span>
        </div>
      </div>

      {/* MACD */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">MACD</span>
          <span className={`text-xs font-medium ${macdLabel.color}`}>{macdLabel.text}</span>
        </div>
        <p className={`text-2xl font-bold mt-1 ${macdNum >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {macdNum.toFixed(2)}
        </p>
        <p className="text-xs text-slate-500 mt-1">Signal: {macdSigNum.toFixed(2)}</p>
        <p className="text-xs text-slate-500">Histogram: {(macdNum - macdSigNum).toFixed(2)}</p>
      </div>

      {/* Bollinger Bands */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">Bollinger Bands</span>
          <span className={`text-xs font-medium ${bbLabel.color}`}>{bbLabel.text}</span>
        </div>
        <div className="mt-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Upper</span>
            <span className="text-red-400 font-mono">{bbUpper.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Middle</span>
            <span className="text-slate-300 font-mono">{bbMiddle.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Lower</span>
            <span className="text-emerald-400 font-mono">{bbLower.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-800">
            <span className="text-slate-500">Width</span>
            <span className="text-slate-300 font-mono">{(bbUpper - bbLower).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
