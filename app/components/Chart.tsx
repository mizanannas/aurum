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
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: 'rgba(255,255,255,0.38)',
      },
      grid: {
        vertLines: { color: 'rgba(212,160,23,0.06)' },
        horzLines: { color: 'rgba(212,160,23,0.06)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(212,160,23,0.4)', labelBackgroundColor: '#1a1408' },
        horzLine: { color: 'rgba(212,160,23,0.4)', labelBackgroundColor: '#1a1408' },
      },
      rightPriceScale: {
        borderColor: 'rgba(212,160,23,0.15)',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: 'rgba(212,160,23,0.15)',
        timeVisible: true,
        secondsVisible: false,
        minBarSpacing: 3,
        rightOffset: 12,
        barSpacing: 8,
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

  const ohlcMuted = 'rgba(255,255,255,0.25)';

  return (
    <div style={{ background: '#0a0a0a' }}>
      {/* Chart header */}
      <div className="px-4 pt-3 pb-2">
        {/* Row 1: tabs (full width on mobile, right-aligned on desktop) */}
        <div className="flex items-center justify-between mb-2">
          {/* Desktop: OHLC left + tabs right */}
          {last ? (
            <div className="hidden md:flex gap-5 text-xs min-w-0 flex-1 mr-3">
              <span className="whitespace-nowrap">
                <span style={{ color: ohlcMuted }}>O </span>
                <span className="font-mono" style={{ color: 'rgba(255,255,255,0.65)' }}>{parseFloat(last.open).toFixed(2)}</span>
              </span>
              <span className="whitespace-nowrap">
                <span style={{ color: ohlcMuted }}>H </span>
                <span className="text-emerald-400 font-mono">{parseFloat(last.high).toFixed(2)}</span>
              </span>
              <span className="whitespace-nowrap">
                <span style={{ color: ohlcMuted }}>L </span>
                <span className="text-red-400 font-mono">{parseFloat(last.low).toFixed(2)}</span>
              </span>
              <span className="whitespace-nowrap">
                <span style={{ color: ohlcMuted }}>C </span>
                <span className="font-mono text-amber-400">{parseFloat(last.close).toFixed(2)}</span>
              </span>
            </div>
          ) : <div className="hidden md:block flex-1" />}

          {/* Timeframe tabs */}
          <div className="flex rounded-lg p-0.5 gap-0.5 w-full md:w-auto" style={{ background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.15)' }}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => handleTab(tf)}
                className="flex-1 md:flex-none px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
                style={activeTab === tf
                  ? { background: '#D4A017', color: '#000000' }
                  : { color: 'rgba(255,255,255,0.45)' }
                }
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: OHLC values — mobile only, full width, no overflow */}
        {last && (
          <div className="md:hidden flex gap-3 text-xs">
            <span className="whitespace-nowrap">
              <span style={{ color: ohlcMuted }}>O </span>
              <span className="font-mono" style={{ color: 'rgba(255,255,255,0.65)' }}>{parseFloat(last.open).toFixed(2)}</span>
            </span>
            <span className="whitespace-nowrap">
              <span style={{ color: ohlcMuted }}>H </span>
              <span className="text-emerald-400 font-mono">{parseFloat(last.high).toFixed(2)}</span>
            </span>
            <span className="whitespace-nowrap">
              <span style={{ color: ohlcMuted }}>L </span>
              <span className="text-red-400 font-mono">{parseFloat(last.low).toFixed(2)}</span>
            </span>
            <span className="whitespace-nowrap">
              <span style={{ color: ohlcMuted }}>C </span>
              <span className="font-mono text-amber-400">{parseFloat(last.close).toFixed(2)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Chart canvas */}
      <div className="relative" style={{ height: '380px' }}>
        <div ref={containerRef} className="w-full h-full" />

        {loading && !data.length && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0a0a0a' }}>
            <div className="text-center">
              <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-2" style={{ border: '2px solid rgba(212,160,23,0.2)', borderTopColor: '#D4A017' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading chart...</p>
            </div>
          </div>
        )}
        {!loading && !data.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No price data available</p>
          </div>
        )}
        {loading && !!data.length && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(10,10,10,0.5)' }}>
            <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid rgba(212,160,23,0.2)', borderTopColor: '#D4A017' }} />
          </div>
        )}
      </div>

      {ready && !!data.length && (
        <p className="text-xs px-4 pb-2 hidden md:block" style={{ color: 'rgba(255,255,255,0.12)' }}>
          Scroll to zoom · Drag to pan · Double-click to reset
        </p>
      )}
    </div>
  );
}
