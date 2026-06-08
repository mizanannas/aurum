'use client';

import React from 'react';
import { Signal } from '@/app/lib/types';

interface SignalsProps {
  signals: Signal[];
  loading?: boolean;
}

const TYPE_STYLE = {
  BUY:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' },
  SELL: { bg: 'bg-red-500/10',     border: 'border-red-500/30',     badge: 'bg-red-500/20 text-red-400',         dot: 'bg-red-400'     },
  HOLD: { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   badge: 'bg-amber-500/20 text-amber-400',     dot: 'bg-amber-400'   },
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SignalsDisplay({ signals, loading = false }: SignalsProps) {
  const buys  = signals.filter(s => s.type === 'BUY').length;
  const sells = signals.filter(s => s.type === 'SELL').length;
  const holds = signals.filter(s => s.type === 'HOLD').length;

  return (
    <div className="bg-slate-950 p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Trading Signals</p>
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-400">{buys} Buy</span>
          <span className="text-red-400">{sells} Sell</span>
          <span className="text-amber-400">{holds} Hold</span>
        </div>
      </div>

      {loading && !signals.length && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-900 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && !signals.length && (
        <div className="py-12 text-center text-slate-500 text-sm">
          No signals yet — signals appear after price data is analyzed
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {signals.slice().reverse().slice(0, 9).map((signal) => {
          const style = TYPE_STYLE[signal.type];
          const price = parseFloat(signal.price as any);
          const ind = signal.indicators;
          return (
            <div key={signal.id} className={`${style.bg} border ${style.border} rounded-lg p-4`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                    {signal.type}
                  </span>
                </div>
                <span className="text-white font-mono font-bold text-sm">${price.toFixed(2)}</span>
              </div>

              {/* Strength bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Strength</span>
                  <span className="text-slate-300 font-medium">{signal.strength}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full ${
                      signal.strength >= 65 ? 'bg-emerald-500'
                      : signal.strength <= 35 ? 'bg-red-500'
                      : 'bg-amber-500'
                    }`}
                    style={{ width: `${signal.strength}%` }}
                  />
                </div>
              </div>

              {/* Indicators */}
              {ind && (
                <div className="grid grid-cols-3 gap-2 text-xs border-t border-slate-700/50 pt-2">
                  <div>
                    <p className="text-slate-500">RSI</p>
                    <p className="text-slate-200 font-mono">{parseFloat(ind.rsi as any)?.toFixed(1) ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">MACD</p>
                    <p className="text-slate-200 font-mono">{parseFloat(ind.macd as any)?.toFixed(1) ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">BB</p>
                    <p className="text-slate-200 font-mono">{ind.bb ? 'OK' : 'N/A'}</p>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-600 mt-2">{formatDate(signal.timestamp)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
