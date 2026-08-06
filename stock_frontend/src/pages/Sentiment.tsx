import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stockAPI } from '../services/api';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Sentiment() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  const { data: sentimentData, isLoading, error } = useQuery({
    queryKey: ['marketSentiment'],
    queryFn: () => stockAPI.getMarketSentiment(30),
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!chartContainerRef.current || !sentimentData?.history || sentimentData.history.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      grid: {
        vertLines: { color: 'rgba(156, 163, 175, 0.1)' },
        horzLines: { color: 'rgba(156, 163, 175, 0.1)' },
      },
      timeScale: {
        borderColor: 'rgba(156, 163, 175, 0.2)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(156, 163, 175, 0.2)',
        autoScale: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
    });

    const series = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
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
    
    const markers = sentimentData.history.map(item => {
      const year = item.date.substring(0, 4);
      const month = item.date.substring(4, 6);
      const day = item.date.substring(6, 8);
      
      let shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown' = 'circle';
      let position: 'aboveBar' | 'belowBar' | 'inBar' = 'inBar';
      
      if (item.score >= 80) {
        shape = 'arrowDown';
        position = 'aboveBar';
      } else if (item.score <= 20) {
        shape = 'arrowUp';
        position = 'belowBar';
      }
      
      return {
        time: `${year}-${month}-${day}`,
        position: position,
        color: item.color,
        shape: shape,
        text: item.level,
        size: 1.5,
      };
    });
    
    series.setMarkers(markers as any);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">市场情绪</h1>
        {summary && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">最新状态:</span>
            <span 
              className="px-3 py-1 rounded-full text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: summary.level_color }}
            >
              {summary.level} ({summary.sentiment_smooth})
            </span>
          </div>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">今日涨停</div>
            <div className="text-xl font-bold text-red-600 dark:text-red-400">{summary.metrics.limit_up_count}家</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">今日跌停</div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400">{summary.metrics.limit_down_count}家</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">净涨停差值</div>
            <div className={`text-xl font-bold ${summary.metrics.net_limit > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {summary.metrics.net_limit > 0 ? '+' : ''}{summary.metrics.net_limit}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">封板率</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{summary.metrics.seal_rate}%</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">连板晋级率</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{(summary.metrics.two_to_three_rate * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">涨跌比</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{summary.metrics.up_down_ratio.toFixed(2)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">次日溢价</div>
            <div className={`text-xl font-bold ${summary.metrics.next_day_premium > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {summary.metrics.next_day_premium.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">历史情绪趋势 (30天平滑分)</h2>
        <div className="w-full relative" style={{ height: '400px' }}>
          <div ref={chartContainerRef} className="absolute inset-0" />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 justify-center">
          <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#FF4D4F] mr-2"></span>超强高潮 (80-100)</div>
          <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#FA8C16] mr-2"></span>升温/强情绪 (60-79)</div>
          <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#1890FF] mr-2"></span>震荡/中性 (40-59)</div>
          <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#52C41A] mr-2"></span>分歧/弱情绪 (20-39)</div>
          <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#722ED1] mr-2"></span>冰点恐慌 (0-19)</div>
        </div>
      </div>
    </div>
  );
}
