'use client';

import React from 'react';
import { Signal } from '@/app/lib/types';

interface SignalsProps {
  signals: Signal[];
  loading?: boolean;
}

const TYPE_STYLE = {
  BUY:  { bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.25)',  badge: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' },
  SELL: { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.25)',   badge: 'bg-red-500/20 text-red-400',         dot: 'bg-red-400'     },
  HOLD: { bg: 'rgba(212,160,23,0.07)',  border: 'rgba(212,160,23,0.25)',  badge: 'bg-amber-500/20 text-amber-400',     dot: 'bg-amber-400'   },
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SignalsDisplay({ signals, loading = false }: SignalsProps) {
  const buys  = signals.filter(s => s.type === 'BUY').length;
  const sells = signals.filter(s => s.type === 'SELL').length;
  const holds = signals.filter(s => s.type === 'HOLD').length;

  const muted = 'rgba(255,255,255,0.38)';
  const dim   = 'rgba(255,255,255,0.18)';

  return (
    <div className="p-4" style={{ background: '#0a0a0a' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-px h-3" style={{ background: '#D4A017' }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#D4A017' }}>Trading Signals</p>
        </div>
        <div className="flex gap-3 text-xs font-medium">
          <span className="text-emerald-400">{buys} Buy</span>
          <span className="text-red-400">{sells} Sell</span>
          <span className="text-amber-400">{holds} Hold</span>
        </div>
      </div>

      {loading && !signals.length && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(212,160,23,0.04)', border: '1px solid rgba(212,160,23,0.1)' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(212,160,23,0.2)' }} />
                  <div className="h-4 w-12 rounded-full" style={{ background: 'rgba(212,160,23,0.15)' }} />
                </div>
                <div className="h-4 w-16 rounded" style={{ background: 'rgba(255,255,255,0.07)' }} />
              </div>
              <div className="mb-3">
                <div className="flex justify-between mb-1.5">
                  <div className="h-3 w-14 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  <div className="h-3 w-8 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {[1,2,3].map(j => (
                  <div key={j}>
                    <div className="h-2.5 w-8 rounded mb-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    <div className="h-3.5 w-10 rounded" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !signals.length && (
        <div className="py-12 text-center text-sm" style={{ color: muted }}>
          No signals yet — signals appear after price data is analyzed
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {signals.slice().reverse().slice(0, 9).map((signal) => {
          const style = TYPE_STYLE[signal.type];
          const price = parseFloat(signal.price as any);
          const ind = signal.indicators;
          return (
            <div
              key={signal.id}
              className="rounded-xl p-4"
              style={{ background: style.bg, border: `1px solid ${style.border}` }}
            >
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
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: muted }}>Strength</span>
                  <span className="font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{signal.strength}%</span>
                </div>
                <div className="w-full rounded-full h-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
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
                <div className="grid grid-cols-3 gap-2 text-xs pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>
                    <p style={{ color: muted }}>RSI</p>
                    <p className="font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>{parseFloat(ind.rsi as any)?.toFixed(1) ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ color: muted }}>MACD</p>
                    <p className="font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>{parseFloat(ind.macd as any)?.toFixed(1) ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ color: muted }}>BB</p>
                    <p className="font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>{ind.bb ? 'OK' : 'N/A'}</p>
                  </div>
                </div>
              )}

              <p className="text-xs mt-2" style={{ color: dim }}>{formatDate(signal.timestamp)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
