'use client';

import { useEffect, useRef, useState } from 'react';
import type { PriceTick } from '@/types';

interface PriceChartProps {
  candles?: PriceTick[];
}

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export default function PriceChart({ candles }: PriceChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartInstance = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('15m');
  const [chartType, setChartType] = useState<'candlestick' | 'area'>('candlestick');

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

  useEffect(() => {
    let chart: any;

    const initChart = async () => {
      if (!chartRef.current) return;

      const { createChart, CrosshairMode, LineStyle } = await import('lightweight-charts');

      const isDark = true;

      chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: chartRef.current.clientHeight,
        layout: {
          background: { color: 'transparent' },
          textColor: '#8892a4',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)', style: LineStyle.Dotted },
          horzLines: { color: 'rgba(255,255,255,0.04)', style: LineStyle.Dotted },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: '#f0c040', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#f0c040' },
          horzLine: { color: '#f0c040', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#f0c040' },
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.08)',
          textColor: '#8892a4',
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.08)',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartInstance.current = chart;

      // Import and generate mock candles here
      const { generateMockCandles } = await import('@/lib/mockData');
      const data = candles ?? generateMockCandles(200);

      if (chartType === 'candlestick') {
        const candleSeries = chart.addCandlestickSeries({
          upColor: '#22d3a5',
          downColor: '#f45c6e',
          borderUpColor: '#22d3a5',
          borderDownColor: '#f45c6e',
          wickUpColor: '#22d3a5',
          wickDownColor: '#f45c6e',
        });
        candleSeries.setData(data);
        seriesRef.current = candleSeries;
      } else {
        const areaSeries = chart.addAreaSeries({
          lineColor: '#f0c040',
          topColor: 'rgba(240, 192, 64, 0.3)',
          bottomColor: 'rgba(240, 192, 64, 0.0)',
          lineWidth: 2,
        });
        const areaData = data.map((c) => ({ time: c.time, value: c.close }));
        areaSeries.setData(areaData);
        seriesRef.current = areaSeries;
      }

      chart.timeScale().fitContent();

      // Simulate live tick
      const tickInterval = setInterval(() => {
        const lastData = data[data.length - 1];
        const delta = (Math.random() - 0.495) * 0.8;
        const newClose = +(lastData.close + delta).toFixed(2);
        const newCandle = {
          time: Math.floor(Date.now() / 1000) as any,
          open: lastData.close,
          high: Math.max(lastData.close, newClose) + Math.random() * 0.3,
          low: Math.min(lastData.close, newClose) - Math.random() * 0.3,
          close: newClose,
        };
        if (chartType === 'candlestick') {
          seriesRef.current?.update(newCandle);
        } else {
          seriesRef.current?.update({ time: newCandle.time, value: newClose });
        }
        lastData.close = newClose;
      }, 1500);

      // Resize observer
      const resizeObserver = new ResizeObserver(() => {
        if (chartRef.current) {
          chart.applyOptions({
            width: chartRef.current.clientWidth,
            height: chartRef.current.clientHeight,
          });
        }
      });
      if (chartRef.current) resizeObserver.observe(chartRef.current);

      return () => {
        clearInterval(tickInterval);
        resizeObserver.disconnect();
      };
    };

    const cleanup = initChart();

    return () => {
      cleanup.then((fn) => fn?.());
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, activeTimeframe]);

  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="title-icon">📈</span>
          <span>Price Chart</span>
          <span className="panel-subtitle">XAUUSD · Gold Spot</span>
        </div>
        <div className="chart-controls">
          <div className="tf-group">
            {timeframes.map((tf) => (
              <button
                key={tf}
                className={`tf-btn ${activeTimeframe === tf ? 'active' : ''}`}
                onClick={() => setActiveTimeframe(tf)}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="type-group">
            <button
              className={`type-btn ${chartType === 'candlestick' ? 'active' : ''}`}
              onClick={() => setChartType('candlestick')}
              title="Candlestick"
            >
              ☷
            </button>
            <button
              className={`type-btn ${chartType === 'area' ? 'active' : ''}`}
              onClick={() => setChartType('area')}
              title="Area"
            >
              ◿
            </button>
          </div>
        </div>
      </div>
      <div ref={chartRef} className="chart-container" />
    </div>
  );
}
