'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

const TIMEFRAMES = ['5M', '1H', '4H', '1D'] as const;
type Timeframe = typeof TIMEFRAMES[number];

export type LiveTick = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

interface ChartProps {
  data?: any[];
  liveTick?: LiveTick | null;   // ← NEW: tick real-time terpisah dari data historis
  loading?: boolean;
  onTimeframeChange?: (tf: Timeframe) => void;
  timeframe?: Timeframe;
}

export default function Chart({ data = [], liveTick = null, loading = false, onTimeframeChange, timeframe: propTf }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const isAtRealTimeRef = useRef(true); // track apakah user sedang di posisi terbaru
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Timeframe>(propTf || '1H');

  useEffect(() => {
    if (propTf) setActiveTab(propTf);
  }, [propTf]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#020617' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#0f172a' },
        horzLines: { color: '#0f172a' },
      },
      crosshair: {
        vertLine: { color: '#334155', labelBackgroundColor: '#1e293b' },
        horzLine: { color: '#334155', labelBackgroundColor: '#1e293b' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
        minBarSpacing: 3,
        rightOffset: 12,        // ruang kosong di kanan candle terakhir
        barSpacing: 8,          // lebar candle default lebih nyaman
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    seriesRef.current = series;

    // Track apakah user scroll mundur — kalau iya, jangan paksa scroll ke kanan
    chart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
      if (!range) return;
      // Dapatkan total bar yang ada
      const totalBars = seriesRef.current?.data()?.length ?? 0;
      // Jika to >= totalBars - 2, berarti user masih di area terbaru
      isAtRealTimeRef.current = range.to >= totalBars - 2;
    });

    setReady(true);

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      initializedRef.current = false;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !seriesRef.current || !data?.length) return;
    try {
      const sorted = [...data].sort((a, b) => a.time - b.time);
      seriesRef.current.setData(sorted);

      // ✅ Set posisi view hanya sekali saat data pertama kali masuk
      // Setelah itu biarkan library yang handle saat data update
      if (!initializedRef.current) {
        const total = sorted.length;
        const show = Math.min(total, 80);
        chartRef.current?.timeScale().setVisibleLogicalRange({
          from: total - show,
          to: total + 12, // ~12 candle ruang kosong di kanan seperti trading platform
        });
        initializedRef.current = true;
      }
    } catch (e) {
      console.warn('Chart data error:', e);
    }
  }, [data, ready]);

  // ── Live tick: gunakan series.update() bukan setData ────────────────────
  // KEY FIX: update() hanya repaint 1 candle — tidak trigger reset chart
  useEffect(() => {
    if (!ready || !seriesRef.current || !liveTick) return;
    try {
      seriesRef.current.update(liveTick);
      // Hanya auto-scroll kalau user masih di posisi terbaru (belum scroll mundur)
      if (isAtRealTimeRef.current) {
        chartRef.current?.timeScale().scrollToRealTime();
      }
    } catch (e) {
      console.warn('Live tick error:', e);
    }
  }, [liveTick, ready]);

  const handleTab = (tf: Timeframe) => {
    setActiveTab(tf);
    initializedRef.current = false; // ✅ reset saat ganti timeframe supaya view ikut reset
    onTimeframeChange?.(tf);
  };

  const last = data[data.length - 1];

  return (
    <div className="bg-slate-950">
      {/* Chart header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        {/* OHLC values */}
        {last ? (
          <div className="flex gap-3 md:gap-5 text-xs min-w-0 flex-1 mr-3">
            <span className="whitespace-nowrap">
              <span className="text-slate-600">O </span>
              <span className="text-slate-300 font-mono">{parseFloat(last.open).toFixed(2)}</span>
            </span>
            <span className="whitespace-nowrap">
              <span className="text-slate-600">H </span>
              <span className="text-emerald-400 font-mono">{parseFloat(last.high).toFixed(2)}</span>
            </span>
            <span className="whitespace-nowrap">
              <span className="text-slate-600">L </span>
              <span className="text-red-400 font-mono">{parseFloat(last.low).toFixed(2)}</span>
            </span>
            <span className="whitespace-nowrap hidden sm:inline">
              <span className="text-slate-600">C </span>
              <span className="text-blue-400 font-mono">{parseFloat(last.close).toFixed(2)}</span>
            </span>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Mobile: dropdown — Desktop: tabs */}
        <div className="flex-shrink-0">
          {/* Mobile dropdown */}
          <div className="md:hidden">
            <div className="relative">
              <select
                value={activeTab}
                onChange={e => handleTab(e.target.value as Timeframe)}
                className="appearance-none bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg pl-3 pr-7 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {TIMEFRAMES.map(tf => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Desktop tabs */}
          <div className="hidden md:flex bg-slate-900 rounded-lg p-0.5 gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => handleTab(tf)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tf
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart canvas — always in DOM so ref is stable */}
      <div className="relative" style={{ height: '380px' }}>
        <div ref={containerRef} className="w-full h-full" />

        {loading && !data.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-500 text-xs">Loading chart...</p>
            </div>
          </div>
        )}
        {!loading && !data.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-slate-500 text-sm">No price data available</p>
          </div>
        )}
        {loading && !!data.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {ready && !!data.length && (
        <p className="text-xs text-slate-800 px-4 pb-2 hidden md:block">
          Scroll to zoom · Drag to pan · Double-click to reset
        </p>
      )}
    </div>
  );
}
