'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('./Chart'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-96 bg-slate-950">
    <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
) });
import IndicatorsDisplay from './Indicators';
import SignalsDisplay from './Signals';
import { Indicators, Signal } from '@/app/lib/types';

type Timeframe = '1H' | '4H' | '1D';

export default function Dashboard() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>('1H');

  const [signals, setSignals] = useState<Signal[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchChartData = useCallback(async (tf: Timeframe) => {
    setChartLoading(true);
    try {
      const res = await fetch(`/api/candles?tf=${tf}`);
      const json = await res.json();
      if (json.success) setChartData(json.data);
    } catch (_) {
      // keep existing data
    } finally {
      setChartLoading(false);
    }
  }, []);

  const fetchAll = async () => {
    try {
      setError(null);

      const [pricesRes, signalsRes] = await Promise.all([
        fetch('/api/prices?limit=100'),
        fetch('/api/signals?limit=20'),
      ]);

      const pricesData = await pricesRes.json();
      const signalsData = await signalsRes.json();

      if (pricesData.success && pricesData.data?.length) {
        setPriceHistory(pricesData.data);
        setCurrentPrice(parseFloat(pricesData.data[pricesData.data.length - 1].close));
      }

      if (signalsData.success && signalsData.data?.length) {
        setSignals(signalsData.data);
        const latest = signalsData.data[signalsData.data.length - 1];
        if (latest.indicators) setIndicators(latest.indicators);
      } else if (!signalsData.success) {
        setError(signalsData.error || 'Database error');
      }

      setLastUpdate(new Date());
    } catch (_) {
      setError('Cannot connect to server');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/fetch-price', { method: 'POST' });
      await Promise.all([fetchAll(), fetchChartData(timeframe)]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    fetchChartData(tf);
  };

  useEffect(() => {
    handleRefresh();
    const interval = setInterval(handleRefresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const priceChange = () => {
    if (priceHistory.length < 2) return { change: 0, pct: 0 };
    const first = parseFloat(priceHistory[0].close);
    const last = parseFloat(priceHistory[priceHistory.length - 1].close);
    return { change: last - first, pct: ((last - first) / first) * 100 };
  };

  const { change, pct } = priceChange();
  const isUp = change >= 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* Top Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-slate-900 font-bold text-sm">Au</div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">AURUM</h1>
            <p className="text-xs text-slate-500 mt-1">XAUUSD · Real-time Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString('id-ID')}` : 'Loading...'}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
          >
            <svg className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Fetching...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-950 border-b border-red-800 px-6 py-3 text-red-300 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Price Hero */}
      <div className="px-6 py-6 border-b border-slate-800">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Price</p>
            <p className="text-3xl font-bold text-white">
              {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Change</p>
            <p className={`text-2xl font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {priceHistory.length >= 2 ? `${isUp ? '+' : ''}${change.toFixed(2)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Change %</p>
            <p className={`text-2xl font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {priceHistory.length >= 2 ? `${isUp ? '+' : ''}${pct.toFixed(2)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Signal</p>
            {signals.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold px-3 py-1 rounded-full text-sm ${
                  signals[signals.length - 1].type === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : signals[signals.length - 1].type === 'SELL'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {signals[signals.length - 1].type}
                </span>
                <span className="text-slate-400 text-sm">{signals[signals.length - 1].strength}%</span>
              </div>
            ) : (
              <p className="text-slate-500">—</p>
            )}
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
