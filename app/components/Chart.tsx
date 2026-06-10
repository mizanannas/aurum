'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

const TIMEFRAMES = ['5M', '1H', '4H', '1D'] as const;
type Timeframe = typeof TIMEFRAMES[number];

interface ChartProps {
  data?: any[];
  loading?: boolean;
  onTimeframeChange?: (tf: Timeframe) => void;
}

export default function Chart({ data = [], loading = false, onTimeframeChange }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Timeframe>('1H');

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
      rightPriceScale: { borderColor: '#1e293b' },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      height: 420,
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
    setReady(true);

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !seriesRef.current || !data?.length) return;
    try {
      seriesRef.current.setData(data);
      chartRef.current?.timeScale().fitContent();
    } catch (e) {
      console.warn('Chart data error:', e);
    }
  }, [data, ready]);

  const handleTab = (tf: Timeframe) => {
    setActiveTab(tf);
    onTimeframeChange?.(tf);
  };

  const last = data[data.length - 1];

  return (
    <div className="bg-slate-950 p-4">
      {/* Header row: OHLC + tabs */}
      <div className="flex items-center justify-between mb-3">
        {last ? (
          <div className="flex gap-5 text-xs">
            <span><span className="text-slate-500">O </span><span className="text-slate-300 font-mono">{parseFloat(last.open).toFixed(2)}</span></span>
            <span><span className="text-slate-500">H </span><span className="text-emerald-400 font-mono">{parseFloat(last.high).toFixed(2)}</span></span>
            <span><span className="text-slate-500">L </span><span className="text-red-400 font-mono">{parseFloat(last.low).toFixed(2)}</span></span>
            <span><span className="text-slate-500">C </span><span className="text-blue-400 font-mono">{parseFloat(last.close).toFixed(2)}</span></span>
          </div>
        ) : (
          <div />
        )}

        {/* Timeframe tabs */}
        <div className="flex bg-slate-900 rounded-lg p-0.5 gap-0.5">
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

      {/* Chart container — always in DOM so ref is stable at mount */}
      <div className="relative" style={{ height: '420px' }}>
        <div ref={containerRef} className="w-full h-full" />

        {loading && !data.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Loading chart...</p>
            </div>
          </div>
        )}

        {!loading && !data.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-slate-500 text-sm">No price data available</p>
          </div>
        )}

        {/* Loading overlay saat ganti tab */}
        {loading && !!data.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {ready && !!data.length && (
        <p className="text-xs text-slate-700 mt-2">Scroll to zoom · Drag to pan · Double-click to reset</p>
      )}
    </div>
  );
}
