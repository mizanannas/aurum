'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DollarSign, TrendingUp, TrendingDown, CandlestickChart, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('./Chart'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center" style={{ height: '440px', background: '#0a0a0a' }}>
    <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid rgba(212,160,23,0.15)', borderTopColor: '#D4A017' }} />
  </div>
) });
import IndicatorsDisplay from './Indicators';
import SignalsDisplay from './Signals';
import { Indicators, Signal } from '@/app/lib/types';

type Timeframe = '5M' | '15M' | '30M' | '1H' | '4H' | '1D' | '1W';

type LiveTick = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export default function Dashboard() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [liveTick, setLiveTick] = useState<LiveTick | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    if (typeof window === 'undefined') return '1H';
    const s = localStorage.getItem('aurum_tf') as Timeframe;
    return (['5M', '15M', '30M', '1H', '4H', '1D', '1W'] as Timeframe[]).includes(s) ? s : '1H';
  });
  const timeframeRef = useRef<Timeframe>(
    typeof window !== 'undefined' && (['5M','15M','30M','1H','4H','1D','1W'] as Timeframe[]).includes(localStorage.getItem('aurum_tf') as Timeframe)
      ? (localStorage.getItem('aurum_tf') as Timeframe)
      : '1H'
  );

  const [signals, setSignals] = useState<Signal[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveTickRef = useRef<LiveTick | null>(null);

  // ── FIX: Track last candle time dari historical data ──────────────────────
  // Ini dipakai untuk validasi bahwa liveTick tidak lebih kecil dari data historis
  const lastHistoricalTimeRef = useRef<number>(0);

  const fetchChartData = useCallback(async (tf: Timeframe, showSpinner = false) => {
    if (showSpinner) setChartLoading(true);
    setLiveTick(null);
    liveTickRef.current = null;
    try {
      const res = await fetch(`/api/candles?tf=${tf}`);
      const json = await res.json();
      if (json.success && json.data?.length) {
        const sorted = [...json.data].sort((a: any, b: any) => a.time - b.time);
        setChartData(sorted);
        // ── FIX: simpan waktu candle terakhir dari historical ──────────────
        lastHistoricalTimeRef.current = sorted[sorted.length - 1].time;
      }
    } catch (_) {
      // keep existing data on error
    } finally {
      setChartLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async (tf?: string) => {
    try {
      setError(null);
      const timeframe = tf ?? timeframeRef.current;
      const res = await fetch(`/api/signals?limit=20&timeframe=${timeframe}`);
      const json = await res.json();
      if (json.success && json.data?.length) {
        setSignals(json.data);
        const latest = json.data[json.data.length - 1];
        if (latest.indicators) setIndicators(latest.indicators);
      } else if (!json.success) {
        setError(json.error || 'Database error');
      }
      setLastUpdate(new Date());
    } catch (_) {
      setError('Cannot connect to server');
    }
  }, []);

  // backgroundSync hanya untuk signals & indicators — TIDAK menyentuh chartData.
  // Chart di-update eksklusif via WebSocket liveTick agar tidak ada setData() ulang
  // yang menyebabkan chart reset / candle melompat ke atas.
  const backgroundSync = useCallback(async () => {
    try {
      await fetch('/api/fetch-price', { method: 'POST' });
      await fetchAll();
    } catch (_) {}
  }, [fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Manual refresh tetap fetch semua termasuk chart
      await fetch('/api/fetch-price', { method: 'POST' });
      await Promise.all([fetchAll(), fetchChartData(timeframeRef.current, true)]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    timeframeRef.current = tf;
    localStorage.setItem('aurum_tf', tf);
    fetchChartData(tf, true);
    fetchAll(tf);
  };

  const getPeriodSec = (tf: Timeframe) =>
    ({ '5M': 300, '15M': 900, '30M': 1800, '1H': 3600, '4H': 14400, '1D': 86400, '1W': 604800 } as Record<Timeframe, number>)[tf];

  const handleTick = useCallback((price: number, tsSec: number) => {
    // ── FIX: Normalkan timestamp — TwelveData kadang kirim ms bukan detik ──
    // Jika timestamp > 1e10, berarti dalam milliseconds → bagi 1000
    const normalizedTs = tsSec > 1e10 ? Math.floor(tsSec / 1000) : Math.floor(tsSec);

    const period = getPeriodSec(timeframeRef.current);
    const periodStart = Math.floor(normalizedTs / period) * period;

    // ── FIX: Validasi — jangan proses tick yang timestampnya lebih kecil dari
    // candle historis terakhir (out-of-order atau stale data) ─────────────────
    if (periodStart < lastHistoricalTimeRef.current) {
      return;
    }

    setLiveTick(prev => {
      if (prev && prev.time === periodStart) {
        const updated: LiveTick = {
          ...prev,
          close: price,
          high: Math.max(prev.high, price),
          low:  Math.min(prev.low,  price),
        };
        liveTickRef.current = updated;
        return updated;
      }

      if (!prev || periodStart > prev.time) {
        // Seed open dari close sebelumnya jika tersedia
        const seedOpen = prev?.close ?? price;
        const newCandle: LiveTick = {
          time: periodStart,
          open: seedOpen,
          high: Math.max(seedOpen, price),
          low:  Math.min(seedOpen, price),
          close: price,
        };
        liveTickRef.current = newCandle;
        return newCandle;
      }

      return prev;
    });
  }, []);

  const connectWS = useCallback(() => {
    const key = process.env.NEXT_PUBLIC_TWELVEDATA_KEY;
    if (!key) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${key}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: 'XAU/USD' } }));
    };

    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === 'price' && msg.price != null) {
          handleTick(parseFloat(msg.price), msg.timestamp);
        }
      } catch {}
    };

    ws.onerror = () => ws.close();

    ws.onclose = () => {
      setWsConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connectWS, 4000);
    };
  }, [handleTick]);

  useEffect(() => {
    connectWS();
    return () => {
      reconnectTimer.current && clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connectWS]);

  useEffect(() => {
    Promise.all([fetchAll(), fetchChartData(timeframeRef.current, true)]);
    backgroundSync();
    const interval = setInterval(backgroundSync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const currentPrice = liveTick?.close ?? (chartData.length ? chartData[chartData.length - 1].close : 0);

  const priceChange = () => {
    if (chartData.length < 2) return { change: 0, pct: 0 };
    const first = chartData[0].close;
    const last = liveTick?.close ?? chartData[chartData.length - 1].close;
    return { change: last - first, pct: ((last - first) / first) * 100 };
  };
  const { change, pct } = priceChange();
  const isUp = change >= 0;

  const latestSignal = signals[signals.length - 1];

  const high24 = chartData.length
    ? Math.max(...chartData.map(c => c.high), liveTick?.high ?? 0)
    : 0;
  const low24 = chartData.length
    ? Math.min(...chartData.map(c => c.low), liveTick?.low ?? Infinity)
    : 0;

  const Triangle = ({ up, size = 10 }: { up: boolean; size?: number }) => {
    const h = Math.round(size * 0.78);
    const pad = Math.round(size * 0.4);
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${pad}px`,
          borderRadius: '4px',
          backgroundColor: up ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          flexShrink: 0,
        }}
      >
        <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} style={{ display: 'block' }}>
          {up
            ? <polygon points={`${size / 2},0 ${size},${h} 0,${h}`} fill="#10b981" />
            : <polygon points={`0,0 ${size},0 ${size / 2},${h}`} fill="#ef4444" />
          }
        </svg>
      </span>
    );
  };

  const gold = '#D4A017';
  const goldBorder = 'rgba(212,160,23,0.2)';
  const goldBg = 'rgba(212,160,23,0.07)';
  const muted = 'rgba(255,255,255,0.38)';

  return (
    <div className="min-h-screen text-white" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3" style={{ background: '#060504', borderBottom: `1px solid ${goldBorder}` }}>
        <div className="flex items-center gap-3">
          {/* Logo badge — gold gradient */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #B8860B, #D4A017, #F0C040)', color: '#000' }}>
            Au
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm md:text-base tracking-wide">AURUM</span>
              {currentPrice > 0 && (
                <span className="md:hidden text-sm font-mono font-semibold text-white">
                  ${currentPrice.toFixed(2)}
                </span>
              )}
              {currentPrice > 0 && chartData.length >= 2 && (
                <span className={`md:hidden inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${
                  isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  <Triangle up={isUp} />
                  {Math.abs(pct).toFixed(2)}%
                </span>
              )}
            </div>
            <p className="hidden md:block text-xs mt-0.5" style={{ color: muted }}>XAUUSD · Real-time Analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* LIVE indicator */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: wsConnected ? gold : 'rgba(255,255,255,0.2)',
                       boxShadow: wsConnected ? `0 0 6px ${gold}` : 'none',
                       animation: wsConnected ? 'pulse 2s infinite' : 'none' }} />
            <span className="text-xs font-semibold hidden sm:inline" style={{ color: wsConnected ? gold : muted }}>
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <span className="hidden md:inline text-xs" style={{ color: muted }}>
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString('id-ID')}` : 'Loading...'}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
            className="flex items-center gap-1.5 p-2 md:px-3 md:py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: goldBg, border: `1px solid ${goldBorder}`, color: gold }}
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden md:inline text-xs font-medium">{refreshing ? 'Fetching...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border-b border-red-800 px-4 py-2.5 text-red-300 text-xs md:text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Price Hero */}
      <div className="px-4 md:px-6 py-4 md:py-6" style={{ borderBottom: `1px solid ${goldBorder}` }}>
        {/* Mobile */}
        <div className="md:hidden">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: gold }}>XAU / USD</p>
          {chartLoading && currentPrice === 0 ? (
            <div className="animate-pulse space-y-3">
              <div className="h-12 rounded-lg w-48" style={{ background: 'rgba(212,160,23,0.1)' }} />
              <div className="h-5 rounded w-32" style={{ background: 'rgba(212,160,23,0.07)' }} />
              <div className="flex gap-4 pt-2" style={{ borderTop: `1px solid ${goldBorder}` }}>
                <div className="h-4 rounded w-20" style={{ background: 'rgba(212,160,23,0.07)' }} />
                <div className="h-4 rounded w-20" style={{ background: 'rgba(212,160,23,0.07)' }} />
              </div>
            </div>
          ) : (<>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <p className="text-5xl font-bold text-white tracking-tight leading-none">
                {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '—'}
              </p>
              {chartData.length >= 2 && <Triangle up={isUp} size={18} />}
            </div>
            {latestSignal && (
              <div className={`flex flex-col items-center px-3 py-2 rounded-xl ${
                latestSignal.type === 'BUY' ? 'bg-emerald-500/15 border border-emerald-500/30'
                : latestSignal.type === 'SELL' ? 'bg-red-500/15 border border-red-500/30'
                : 'bg-amber-500/15 border border-amber-500/30'
              }`}>
                <span className={`text-sm font-bold ${
                  latestSignal.type === 'BUY' ? 'text-emerald-400'
                  : latestSignal.type === 'SELL' ? 'text-red-400'
                  : 'text-amber-400'
                }`}>{latestSignal.type}</span>
                <span className="text-xs" style={{ color: muted }}>{latestSignal.strength}%</span>
              </div>
            )}
          </div>
          {chartData.length >= 2 && (
            <div className={`flex items-center gap-2 mb-3 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className="text-lg font-bold font-mono">{isUp ? '+' : ''}{change.toFixed(2)}</span>
              <Triangle up={isUp} size={12} />
              <span className="text-sm font-medium opacity-80">({isUp ? '+' : ''}{pct.toFixed(2)}%)</span>
            </div>
          )}
          <div className="flex items-center gap-4 pt-2" style={{ borderTop: `1px solid ${goldBorder}` }}>
            <div className="flex items-center gap-1.5">
              <Triangle up={true} size={8} />
              <span className="text-xs" style={{ color: muted }}>H</span>
              <span className="text-xs font-mono text-white/70">{high24 ? high24.toFixed(2) : '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Triangle up={false} size={8} />
              <span className="text-xs" style={{ color: muted }}>L</span>
              <span className="text-xs font-mono text-white/70">{low24 ? low24.toFixed(2) : '—'}</span>
            </div>
            <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {lastUpdate ? lastUpdate.toLocaleTimeString('id-ID') : ''}
            </span>
          </div>
          </>)}
        </div>

        {/* Desktop */}
        {chartLoading && currentPrice === 0 ? (
          <div className="hidden md:grid md:grid-cols-4 gap-4 animate-pulse">
            {[
              { icon: <DollarSign className="w-3.5 h-3.5" style={{ color: gold }} />, label: 'Price',    w1: 'w-1/4', w2: 'w-3/5', w3: null },
              { icon: <TrendingUp  className="w-3.5 h-3.5" style={{ color: gold }} />, label: 'Change',   w1: 'w-1/4', w2: 'w-2/5', w3: 'w-1/3' },
              { icon: <CandlestickChart className="w-3.5 h-3.5" style={{ color: gold }} />, label: 'High / Low', w1: 'w-1/3', w2: 'w-1/2', w3: 'w-1/2' },
              { icon: <Zap         className="w-3.5 h-3.5" style={{ color: gold }} />, label: 'Signal',   w1: 'w-1/4', w2: 'w-2/5', w3: null },
            ].map(({ icon, label, w1, w2, w3 }) => (
              <div key={label} className="rounded-xl p-4" style={{ background: goldBg, border: `1px solid ${goldBorder}` }}>
                <div className="flex items-center gap-1.5 mb-3">
                  {icon}
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: muted }}>{label}</p>
                </div>
                <div className={`h-8 rounded-lg mb-2 ${w2}`} style={{ background: 'rgba(212,160,23,0.12)' }} />
                {w3 && <div className={`h-4 rounded ${w3}`} style={{ background: 'rgba(212,160,23,0.08)' }} />}
              </div>
            ))}
          </div>
        ) : (
        <div className="hidden md:grid md:grid-cols-4 gap-4">
          {/* Price */}
          <div className="rounded-xl p-4" style={{ background: goldBg, border: `1px solid ${goldBorder}` }}>
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="w-3.5 h-3.5" style={{ color: gold }} />
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: muted }}>Price</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-white">{currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '—'}</p>
              {chartData.length >= 2 && <Triangle up={isUp} />}
            </div>
          </div>
          {/* Change */}
          <div className="rounded-xl p-4" style={{ background: goldBg, border: `1px solid ${goldBorder}` }}>
            <div className="flex items-center gap-1.5 mb-2">
              {isUp
                ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              }
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: muted }}>Change</p>
            </div>
            {chartData.length >= 2 ? (
              <div className={isUp ? 'text-emerald-400' : 'text-red-400'}>
                <div className="flex items-center gap-1.5">
                  <p className="text-2xl font-bold leading-tight">{isUp ? '+' : ''}{change.toFixed(2)}</p>
                  <Triangle up={isUp} />
                </div>
                <p className="text-sm font-medium opacity-80">{isUp ? '+' : ''}{pct.toFixed(2)}%</p>
              </div>
            ) : <p style={{ color: muted }}>—</p>}
          </div>
          {/* High / Low */}
          <div className="rounded-xl p-4" style={{ background: goldBg, border: `1px solid ${goldBorder}` }}>
            <div className="flex items-center gap-1.5 mb-2">
              <CandlestickChart className="w-3.5 h-3.5" style={{ color: gold }} />
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: muted }}>High / Low</p>
            </div>
            <p className="text-xl font-bold text-emerald-400">{high24 ? high24.toFixed(2) : '—'}</p>
            <p className="text-xl font-bold text-red-400">{low24 ? low24.toFixed(2) : '—'}</p>
          </div>
          {/* Signal */}
          <div className="rounded-xl p-4" style={{ background: goldBg, border: `1px solid ${goldBorder}` }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5" style={{ color: gold }} />
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: muted }}>Signal</p>
            </div>
            {latestSignal ? (
              <div className="flex items-center gap-2">
                <span className={`font-bold px-3 py-1 rounded-full text-sm ${
                  latestSignal.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400'
                  : latestSignal.type === 'SELL' ? 'bg-red-500/20 text-red-400'
                  : 'bg-amber-500/20 text-amber-400'
                }`}>{latestSignal.type}</span>
                <span className="text-sm" style={{ color: muted }}>{latestSignal.strength}%</span>
              </div>
            ) : <p style={{ color: muted }}>—</p>}
          </div>
        </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        <div className="lg:col-span-2" style={{ borderRight: `1px solid ${goldBorder}` }}>
          <Chart
            data={chartData}
            liveTick={timeframe === '5M' ? liveTick : null}
            loading={chartLoading}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
          />
        </div>
        <div>
          <IndicatorsDisplay indicators={indicators} currentPrice={currentPrice} loading={refreshing} />
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${goldBorder}` }}>
        <SignalsDisplay signals={signals} loading={refreshing} />
      </div>

      <div className="text-center py-4 text-xs" style={{ borderTop: `1px solid ${goldBorder}`, color: 'rgba(255,255,255,0.18)' }}>
        Auto-refresh every 5 min · Powered by Tiingo API · Not financial advice
      </div>
    </div>
  );
}
