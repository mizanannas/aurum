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

export default function Dashboard() {
  const [chartData, setChartData] = useState<any[]>([]);
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

  const fetchChartData = useCallback(async (tf: Timeframe, showSpinner = false) => {
    if (showSpinner) setChartLoading(true);
    try {
      const res = await fetch(`/api/candles?tf=${tf}`);
      const json = await res.json();
      if (json.success && json.data?.length) setChartData(json.data);
    } catch (_) {
      // keep existing data on error
    } finally {
      setChartLoading(false);
    }
  }, []);

  // Only fetches signals — price/chart data comes from fetchChartData
  const fetchAll = async () => {
    try {
      setError(null);
      const res = await fetch('/api/signals?limit=20');
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
  };

  // Background: fetch fresh data from Tiingo, then silently update UI
  const backgroundSync = useCallback(async () => {
    try {
      await fetch('/api/fetch-price', { method: 'POST' });
      await Promise.all([fetchAll(), fetchChartData(timeframeRef.current)]);
    } catch (_) {}
  }, [fetchAll, fetchChartData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await backgroundSync();
    } finally {
      setRefreshing(false);
    }
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    timeframeRef.current = tf;
    localStorage.setItem('aurum_tf', tf);
    fetchChartData(tf, true);
  };

  useEffect(() => {
    // 1. Load DB immediately — chart shows in <200ms
    Promise.all([fetchAll(), fetchChartData(timeframeRef.current, true)]);

    // 2. Background: sync Tiingo data
    backgroundSync();

    // 3. Auto-refresh every 5 min (background, no spinner)
    const interval = setInterval(backgroundSync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Derive price stats from 1H chart data (always available, no extra DB call)
  const currentPrice = chartData.length ? chartData[chartData.length - 1].close : 0;
  const priceChange = () => {
    if (chartData.length < 2) return { change: 0, pct: 0 };
    const first = chartData[0].close;
    const last = chartData[chartData.length - 1].close;
    return { change: last - first, pct: ((last - first) / first) * 100 };
  };
  const { change, pct } = priceChange();
  const isUp = change >= 0;

  const latestSignal = signals[signals.length - 1];

  // 24H high/low from chart data
  const high24 = chartData.length ? Math.max(...chartData.map(c => c.high)) : 0;
  const low24  = chartData.length ? Math.min(...chartData.map(c => c.low))  : 0;

  // Filled triangle — size prop controls px width
  const Triangle = ({ up, size = 10 }: { up: boolean; size?: number }) => {
    const h = Math.round(size * 0.78);
    return (
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className="inline-block flex-shrink-0">
        {up
          ? <polygon points={`${size/2},0 ${size},${h} 0,${h}`} fill="#10b981" />
          : <polygon points={`0,0 ${size},0 ${size/2},${h}`} fill="#ef4444" />
        }
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Top Bar ── */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
        {/* Left: logo + name */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-slate-900 font-bold text-sm flex-shrink-0">Au</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-white leading-none">AURUM</h1>
              {/* Mobile: live price next to title */}
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

        {/* Right: updated time + refresh */}
        <div className="flex items-center gap-2 md:gap-3">
          <span className="hidden md:inline text-xs text-slate-500">
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString('id-ID')}` : 'Loading...'}
          </span>
          {/* Mobile: icon only — Desktop: icon + text */}
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

      {/* Error Banner */}
      {error && (
        <div className="bg-red-950 border-b border-red-800 px-4 py-2.5 text-red-300 text-xs md:text-sm">
          ⚠ {error}
        </div>
      )}

      {/* ── Price Hero ── */}
      <div className="px-4 md:px-6 py-4 md:py-6 border-b border-slate-800">
        {/* ── Mobile: flat layout ── */}
        <div className="md:hidden">
          {/* Row 1: price + signal badge */}
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

          {/* Row 2: change amount + pct inline */}
          {chartData.length >= 2 && (
            <div className={`flex items-center gap-2 mb-3 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              <Triangle up={isUp} size={12} />
              <span className="text-lg font-bold font-mono">
                {isUp ? '+' : ''}{change.toFixed(2)}
              </span>
              <span className="text-sm font-medium opacity-80">
                ({isUp ? '+' : ''}{pct.toFixed(2)}%)
              </span>
            </div>
          )}

          {/* Row 3: H/L + Updated — flat text, no cards */}
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

        {/* Desktop layout: 4 columns */}
        <div className="hidden md:grid md:grid-cols-4 gap-6">
          {/* Price + triangle */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Price</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-white">
                {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '—'}
              </p>
              {chartData.length >= 2 && <Triangle up={isUp} />}
            </div>
          </div>
          {/* Change: dollar + pct combined */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Change</p>
            {chartData.length >= 2 ? (
              <div className={`flex items-center gap-2 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                <Triangle up={isUp} />
                <div>
                  <p className="text-2xl font-bold leading-tight">
                    {isUp ? '+' : ''}{change.toFixed(2)}
                  </p>
                  <p className="text-sm font-medium opacity-80">
                    {isUp ? '+' : ''}{pct.toFixed(2)}%
                  </p>
                </div>
              </div>
            ) : <p className="text-slate-500">—</p>}
          </div>
          {/* High / Low */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">High / Low</p>
            <p className="text-xl font-bold text-emerald-400">{high24 ? high24.toFixed(2) : '—'}</p>
            <p className="text-xl font-bold text-red-400">{low24 ? low24.toFixed(2) : '—'}</p>
          </div>
          {/* Signal */}
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

        {/* Chart — 2/3 width */}
        <div className="lg:col-span-2 border-r border-slate-800">
          <Chart
            data={chartData}
            loading={chartLoading}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
          />
        </div>

        {/* Indicators — 1/3 width */}
        <div>
          <IndicatorsDisplay indicators={indicators} currentPrice={currentPrice} loading={refreshing} />
        </div>
      </div>

      {/* Signals */}
      <div className="border-t border-slate-800">
        <SignalsDisplay signals={signals} loading={refreshing} />
      </div>

      <div className="text-center py-4 text-xs text-slate-600 border-t border-slate-800">
        Auto-refresh every 5 min · Powered by Tiingo API · Not financial advice
      </div>
    </div>
  );
}
