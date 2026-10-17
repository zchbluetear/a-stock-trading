import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { stockAPI } from '../services/api';
import { useWatchlistStore } from '../store/watchlistStore';
import { useEffect } from 'react';
import AIAnalyzeButton from '../components/AIAnalyzeButton';
import { SentimentDashboard } from './Sentiment';

// 判断是否在交易时间
function isTradingTime(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay(); // 0=周日, 6=周六
  
  // 周末不交易
  if (day === 0 || day === 6) return false;
  
  // 交易时间：9:30-11:30, 13:00-15:00
  const morningStart = hour === 9 && minute >= 30 || hour > 9 && hour < 11 || hour === 11 && minute <= 30;
  const afternoonStart = hour >= 13 && hour < 15;
  
  return morningStart || afternoonStart;
}

// 根据交易时间返回更新间隔（毫秒）
function getRefetchInterval(): number {
  return isTradingTime() ? 5000 : 60000; // 交易时间5秒，非交易时间60秒
}

export default function Home() {
  const { items, fetchWatchlist } = useWatchlistStore();

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const fetchIndexData = async (code: string) => {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5001`;
    const res = await fetch(`${apiUrl}/api/sina/realtime/${code}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.message || data.error);
    return data;
  };

  const { data: shIndex, isLoading: shLoading } = useQuery({
    queryKey: ['realtime', 'sh000001'],
    queryFn: () => fetchIndexData('sh000001'),
    refetchInterval: getRefetchInterval(),
    retry: 2,
  });
  const { data: szIndex, isLoading: szLoading } = useQuery({
    queryKey: ['realtime', 'sz399001'],
    queryFn: () => fetchIndexData('sz399001'),
    refetchInterval: getRefetchInterval(),
    retry: 2,
  });
  const { data: cybIndex, isLoading: cybLoading } = useQuery({
    queryKey: ['realtime', 'sz399006'],
    queryFn: () => fetchIndexData('sz399006'),
    refetchInterval: getRefetchInterval(),
    retry: 2,
  });

  return (
    <div className="space-y-4">
      <section className="space-y-2" aria-label="市场指数">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">市场指数</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <div className="grid grid-cols-1 divide-y divide-gray-200 dark:divide-gray-700 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
            <IndexCard title="上证指数" data={shIndex} isLoading={shLoading} />
            <IndexCard title="深证成指" data={szIndex} isLoading={szLoading} />
            <IndexCard title="创业板指" data={cybIndex} isLoading={cybLoading} />
          </div>
        </div>
      </section>

      <SentimentDashboard />

      {/* 自选股列表 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            自选股 <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">{items.length}</span>
          </h2>
          <Link
            to="/watchlist"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-gray-600 dark:text-blue-400 dark:hover:bg-gray-700"
          >
            管理自选
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center dark:border-gray-600">
            <p className="text-gray-500 dark:text-gray-400">暂无自选股</p>
            <Link
              to="/watchlist"
              className="mt-3 inline-flex rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              添加自选股
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <StockCard key={item.code} code={item.code} name={item.name} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

function IndexCard({ title, data, isLoading }: { title: string; data: any; isLoading: boolean }) {
  const changePercent = Number(data?.change_percent ?? 0);
  const changeValue = data?.current_price != null && data?.yesterday_close != null
    ? Number(data.current_price) - Number(data.yesterday_close)
    : 0;
  const isUp = changePercent >= 0;
  const movementColor = isUp ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';

  return (
    <div className="px-3 py-3 sm:px-5">
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</div>
      {isLoading ? (
        <div className="mt-3 h-8 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
      ) : data?.current_price != null ? (
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <div className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
            {Number(data.current_price).toFixed(2)}
          </div>
          <div className={`text-right text-sm font-semibold tabular-nums ${movementColor}`}>
            <div>{isUp ? '+' : ''}{changePercent.toFixed(2)}%</div>
            <div className="text-xs font-medium opacity-80">{isUp ? '+' : ''}{changeValue.toFixed(2)} 点</div>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-gray-400">指数行情暂不可用</div>
      )}
    </div>
  );
}

function StockCard({ code, name }: { code: string; name?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['realtime', code],
    queryFn: () => stockAPI.getRealtime(code),
    refetchInterval: getRefetchInterval(),
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <Link to={`/stock/${code}`} className="flex-1">
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
              {name || code}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{code}</p>
          </div>
        </Link>
      </div>
      {isLoading ? (
        <div className="text-gray-400">加载中...</div>
      ) : data ? (
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {data.current_price?.toFixed(2)}
          </div>
          <div
            className={`text-lg font-semibold mb-3 ${
              data.change_percent >= 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {data.change_percent >= 0 ? '+' : ''}
            {data.change_percent?.toFixed(2)}%
          </div>
          <AIAnalyzeButton code={code} className="w-full text-sm" />
        </div>
      ) : (
        <div className="text-gray-400">数据获取失败</div>
      )}
    </div>
  );
}
