import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { stockAPI } from '../services/api';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import LoadingSpinner from '../components/LoadingSpinner';

export function SentimentDashboard() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  const { data: sentimentData, isLoading, error } = useQuery({
    queryKey: ['marketSentiment'],
    queryFn: () => stockAPI.getMarketSentiment(30),
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!chartContainerRef.current || !sentimentData?.history || sentimentData.history.length === 0) return;

    const isDark = document.documentElement.classList.contains('dark');
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#9ca3af' : '#6b7280',
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(156, 163, 175, 0.08)' : 'rgba(107, 114, 128, 0.08)' },
        horzLines: { color: isDark ? 'rgba(156, 163, 175, 0.12)' : 'rgba(107, 114, 128, 0.12)' },
      },
      timeScale: {
        borderColor: isDark ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)',
        timeVisible: false,
        barSpacing: 22,
        minBarSpacing: 18,
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)',
        autoScale: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
    });

    const series = chart.addAreaSeries({
      lineColor: '#2563eb',
      topColor: 'rgba(37, 99, 235, 0.24)',
      bottomColor: 'rgba(37, 99, 235, 0.015)',
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: '#fff',
      crosshairMarkerBackgroundColor: '#3b82f6',
      autoscaleInfoProvider: () => ({
        priceRange: {
          minValue: 0,
          maxValue: 100,
        },
      }),
    });

    [20, 40, 60, 80].forEach((score) => {
      series.createPriceLine({
        price: score,
        color: isDark ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: '',
      });
    });

    const formattedData = sentimentData.history.map(item => {
      const year = item.date.substring(0, 4);
      const month = item.date.substring(4, 6);
      const day = item.date.substring(6, 8);
      
      return {
        time: `${year}-${month}-${day}`,
        value: item.smooth_score,
      };
    });

    series.setData(formattedData);
    
    const markers = sentimentData.history.map((item, index) => {
      const year = item.date.substring(0, 4);
      const month = item.date.substring(4, 6);
      const day = item.date.substring(6, 8);

      return {
        time: `${year}-${month}-${day}`,
        position: index % 2 === 0 ? 'aboveBar' : 'belowBar',
        color: item.color,
        shape: 'circle',
        text: String(Math.round(item.smooth_score)),
        size: 1,
      };
    });
    
    series.setMarkers(markers as any);

    chart.timeScale().fitContent();

    const container = chartContainerRef.current;
    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [sentimentData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-400 p-4 rounded">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-red-700 dark:text-red-200">
              加载数据失败，请检查网络连接或后端服务状态。
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { summary } = sentimentData || {};

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">市场情绪</h1>
          {summary && (
            <span 
              className="px-3 py-1 rounded-full text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: summary.level_color }}
            >
              {summary.level} ({summary.sentiment_smooth})
            </span>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 divide-x divide-gray-200 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">今日涨停</div>
            <div className="text-xl font-bold text-red-600 dark:text-red-400">{summary.metrics.limit_up_count}家</div>
          </div>
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">今日跌停</div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400">{summary.metrics.limit_down_count}家</div>
          </div>
        </div>
      )}

      <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">历史情绪趋势</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">近30个交易日 · 平滑分数 0–100</p>
        </div>
        <div className="overflow-x-auto">
          <div className="relative h-[250px] min-w-[900px] w-full sm:h-[320px]">
            <div ref={chartContainerRef} className="absolute inset-0" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600 dark:text-gray-300">
          <div className="flex items-center rounded-full border border-gray-100 px-2.5 py-1 dark:border-gray-700"><span className="mr-1.5 h-2 w-2 rounded-full bg-[#FF4D4F]"></span>超强 80–100</div>
          <div className="flex items-center rounded-full border border-gray-100 px-2.5 py-1 dark:border-gray-700"><span className="mr-1.5 h-2 w-2 rounded-full bg-[#FA8C16]"></span>升温 60–79</div>
          <div className="flex items-center rounded-full border border-gray-100 px-2.5 py-1 dark:border-gray-700"><span className="mr-1.5 h-2 w-2 rounded-full bg-[#1890FF]"></span>震荡/中性 40–59</div>
          <div className="flex items-center rounded-full border border-gray-100 px-2.5 py-1 dark:border-gray-700"><span className="mr-1.5 h-2 w-2 rounded-full bg-[#52C41A]"></span>分歧/弱情绪 20–39</div>
          <div className="flex items-center rounded-full border border-gray-100 px-2.5 py-1 dark:border-gray-700"><span className="mr-1.5 h-2 w-2 rounded-full bg-[#722ED1]"></span>冰点恐慌 0–19</div>
        </div>
      </div>
    </div>
  );
}

export default function Sentiment() {
  return <Navigate to="/" replace />;
}
