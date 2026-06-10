'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('./Chart'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-96 bg-slate-950">
    <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
) });
import IndicatorsDisplay from './Indicators';
import SignalsDisplay from './Signals';
import { Indicators, Signal } from '@/app/lib/types';

type Timeframe = '5M' | '1H' | '4H' | '1D';

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
    return (['5M', '1H', '4H', '1D'] as Timeframe[]).includes(s) ? s : '1H';
  });
  const timeframeRef = useRef<Timeframe>(
    typeof window !== 'undefined' && (['5M','1H','4H','1D'] as Timeframe[]).includes(localStorage.getItem('aurum_tf') as Timeframe)
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
    ({ '5M': 300, '1H': 3600, '4H': 14400, '1D': 86400 } as Record<Timeframe, number>)[tf];

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
    return (
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} style={{ display: 'inline-block', flexShrink: 0 }}>
        {up
          ? <polygon points={`${size / 2},0 ${size},${h} 0,${h}`} fill="currentColor" />
          : <polygon points={`0,0 ${size},0 ${size / 2},${h}`} fill="currentColor" />
        }
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-slate-950 font-bold text-sm">Au</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm md:text-base">AURUM</span>
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
            <p className="hidden md:block text-xs text-slate-500 mt-0.5">XAUUSD · Real-time Analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className={`text-xs font-medium hidden sm:inline ${wsConnected ? 'text-emerald-400' : 'text-slate-600'}`}>
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <span className="hidden md:inline text-xs text-slate-500">
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString('id-ID')}` : 'Loading...'}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
            className="flex items-center gap-1.5 p-2 md:px-3 md:py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-lg text-slate-300 transition-colors"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden md:inline text-xs">{refreshing ? 'Fetching...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border-b border-red-800 px-4 py-2.5 text-red-300 text-xs md:text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Price Hero */}
      <div className="px-4 md:px-6 py-4 md:py-6 border-b border-slate-800">
        {/* Mobile */}
        <div className="md:hidden">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">XAU / USD</p>
              <div className="flex items-center gap-3">
                <p className="text-5xl font-bold text-white tracking-tight leading-none">
                  {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '—'}
                </p>
                {chartData.length >= 2 && <Triangle up={isUp} size={18} />}
              </div>
            </div>
            {latestSignal && (
              <div className={`flex flex-col items-center px-3 py-2 rounded-xl mt-1 ${
                latestSignal.type === 'BUY' ? 'bg-emerald-500/15 border border-emerald-500/30'
                : latestSignal.type === 'SELL' ? 'bg-red-500/15 border border-red-500/30'
                : 'bg-amber-500/15 border border-amber-500/30'
              }`}>
                <span className={`text-sm font-bold ${
                  latestSignal.type === 'BUY' ? 'text-emerald-400'
                  : latestSignal.type === 'SELL' ? 'text-red-400'
                  : 'text-amber-400'
                }`}>{latestSignal.type}</span>
                <span className="text-xs text-slate-400">{latestSignal.strength}%</span>
              </div>
            )}
          </div>
          {chartData.length >= 2 && (
            <div className={`flex items-center gap-2 mb-3 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              <Triangle up={isUp} size={12} />
              <span className="text-lg font-bold font-mono">{isUp ? '+' : ''}{change.toFixed(2)}</span>
              <span className="text-sm font-medium opacity-80">({isUp ? '+' : ''}{pct.toFixed(2)}%)</span>
            </div>
          )}
          <div className="flex items-center gap-4 pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5">
              <Triangle up={true} size={8} />
              <span className="text-xs text-slate-500">H</span>
              <span className="text-xs font-mono text-slate-300">{high24 ? high24.toFixed(2) : '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Triangle up={false} size={8} />
              <span className="text-xs text-slate-500">L</span>
              <span className="text-xs font-mono text-slate-300">{low24 ? low24.toFixed(2) : '—'}</span>
            </div>
            <span className="ml-auto text-xs text-slate-600">
              {lastUpdate ? lastUpdate.toLocaleTimeString('id-ID') : ''}
            </span>
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden md:grid md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Price</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-white">
                {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '—'}
              </p>
              {chartData.length >= 2 && <Triangle up={isUp} />}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Change</p>
            {chartData.length >= 2 ? (
              <div className={`flex items-center gap-2 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                <Triangle up={isUp} />
                <div>
                  <p className="text-2xl font-bold leading-tight">{isUp ? '+' : ''}{change.toFixed(2)}</p>
                  <p className="text-sm font-medium opacity-80">{isUp ? '+' : ''}{pct.toFixed(2)}%</p>
                </div>
              </div>
            ) : <p className="text-slate-500">—</p>}
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">High / Low</p>
            <p className="text-xl font-bold text-emerald-400">{high24 ? high24.toFixed(2) : '—'}</p>
            <p className="text-xl font-bold text-red-400">{low24 ? low24.toFixed(2) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Signal</p>
            {latestSignal ? (
              <div className="flex items-center gap-2">
                <span className={`font-bold px-3 py-1 rounded-full text-sm ${
                  latestSignal.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400'
                  : latestSignal.type === 'SELL' ? 'bg-red-500/20 text-red-400'
                  : 'bg-amber-500/20 text-amber-400'
                }`}>{latestSignal.type}</span>
                <span className="text-slate-400 text-sm">{latestSignal.strength}%</span>
              </div>
            ) : <p className="text-slate-500">—</p>}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        <div className="lg:col-span-2 border-r border-slate-800">
          <Chart
            data={chartData}
            liveTick={liveTick}
            loading={chartLoading}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
          />
        </div>
        <div>
          <IndicatorsDisplay indicators={indicators} currentPrice={currentPrice} loading={refreshing} />
        </div>
      </div>

      <div className="border-t border-slate-800">
        <SignalsDisplay signals={signals} loading={refreshing} />
      </div>

      <div className="text-center py-4 text-xs text-slate-600 border-t border-slate-800">
        Auto-refresh every 5 min · Powered by Tiingo API · Not financial advice
      </div>
    </div>
  );
}
