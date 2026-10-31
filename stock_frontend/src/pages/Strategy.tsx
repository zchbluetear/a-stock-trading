import { useQuery } from '@tanstack/react-query';
import { stockAPI } from '../services/api';
import { useWatchlistStore } from '../store/watchlistStore';
import { continuousBadgeClass } from '../utils/continuousBadge';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

interface StrongStock {
  code: string;
  name: string;
  t1_limit_time: string;
  t2_limit_time: string;
  consecutive_days: number;
  industry: string;
  current_price: number | null;
  change_percent: number | null;
  amount: number | null;
  strength_type: string | null;
  amplitude_250: number | null;
  breakout_60: boolean | null;
  resonance_score: number | null;
  sector_name: string | null;
  sector_rank: number | null;
  sector_limit_ups: number | null;
  market_up_count: number | null;
  seal_capital: number | null;
  score: number;
}

interface StrongStocksResponse {
  strategy: string;
  description: string;
  params: {
    limit_time: string;
  };
  trade_dates: {
    T: string;
    'T-1': string;
    'T-2': string;
  };
  count: number;
  stocks: StrongStock[];
}

interface NineTurnStock {
  code: string;
  name: string;
  current_price: number | null;
  change_percent: number | null;
  industry: string;
  td_count: number;
  direction: 'buy' | 'sell';
  direction_label: string;
  ma5: number | null;
}

interface NineTurnResponse {
  strategy: string;
  description: string;
  params: { threshold: number };
  count: number;
  scanned: number;
  stocks: NineTurnStock[];
}

type StrategyTab = 'strong_stocks' | 'nine_turn';

const STRATEGY_TABS: { key: StrategyTab; label: string }[] = [
  { key: 'strong_stocks', label: '二板分歧' },
  { key: 'nine_turn', label: '九九归一' },
];

const TIME_OPTIONS = [
  '09:30', '09:45', '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'
];

export default function Strategy() {
  const [strategyType, setStrategyType] = useState<StrategyTab>('strong_stocks');
  const [limitTime, setLimitTime] = useState('11:30');
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [multiMode, setMultiMode] = useState<'fast' | 'balanced' | 'deep'>('fast');
  const [multiError, setMultiError] = useState<string | null>(null);
  const [addingMap, setAddingMap] = useState<Record<string, boolean>>({});
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  const isStrongStocks = strategyType === 'strong_stocks';
  const isNineTurn = strategyType === 'nine_turn';

  const { data, isLoading, error, refetch, isFetching } = useQuery<StrongStocksResponse>({
    queryKey: ['strong-stocks', limitTime],
    queryFn: () => stockAPI.getStrongStocks(limitTime),
    enabled: isStrongStocks,
    refetchInterval: isStrongStocks ? 10000 : false,
    refetchIntervalInBackground: true,
  });

  const {
    data: nineData,
    isLoading: nineLoading,
    error: nineError,
    refetch: nineRefetch,
    isFetching: nineIsFetching,
    dataUpdatedAt: nineUpdatedAt,
  } = useQuery<NineTurnResponse>({
    queryKey: ['nine-turn'],
    queryFn: () => stockAPI.getNineTurnStocks(),
    enabled: isNineTurn,
    refetchInterval: isNineTurn ? 180000 : false,
    refetchIntervalInBackground: true,
    staleTime: 60000,
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents', 'enabled'],
    queryFn: () => stockAPI.getAgents(true),
    enabled: showMultiModal,
  });

  useEffect(() => {
    if (showMultiModal && agents && agents.length > 0 && selectedAgentIds.length === 0) {
      setSelectedAgentIds(agents.map((agent) => agent.id));
    }
  }, [showMultiModal, agents, selectedAgentIds.length]);

  // 格式化涨停时间显示到分钟（将092500转为09:25）
  const formatLimitTime = (time: string | null | undefined): string => {
    if (!time) return '-';
    const str = String(time);
    if (str.includes(':')) return str.slice(0, 5);
    if (str.length === 6) {
      return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
    } else if (str.length === 5) {
      return `0${str.slice(0, 1)}:${str.slice(1, 3)}`;
    }
    return str;
  };

  const toggleSelectCode = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleAddWatchlist = async (code: string, name: string) => {
    if (addingMap[code]) return;
    setAddingMap((prev) => ({ ...prev, [code]: true }));
    try {
      await stockAPI.addWatchlist(code, name);
      setAddedMap((prev) => ({ ...prev, [code]: true }));
      useWatchlistStore.getState().fetchWatchlist();
    } catch (e) {
      console.error('加入自选失败:', e);
      alert('加入自选失败');
    } finally {
      setAddingMap((prev) => ({ ...prev, [code]: false }));
    }
  };

  const handleOpenMulti = () => {
    if (selectedCodes.length < 2) {
      setMultiError('请至少勾选2只股票');
      return;
    }
    setMultiError(null);
    setShowMultiModal(true);
  };

  const handleStartMulti = async () => {
    if (selectedCodes.length < 2) {
      setMultiError('请至少勾选2只股票');
      return;
    }
    if (selectedAgentIds.length < 2) {
      setMultiError('至少选择2个Agent参与辩论');
      return;
    }
    setMultiError(null);
    try {
      const modeConfig = {
        fast: { analysisRounds: 1, debateRounds: 1 },
        balanced: { analysisRounds: 2, debateRounds: 1 },
        deep: { analysisRounds: 3, debateRounds: 2 },
      }[multiMode];
      const res = await stockAPI.startMultiSelectDebate(
        selectedCodes,
        selectedAgentIds,
        modeConfig.analysisRounds,
        modeConfig.debateRounds
      );
      setShowMultiModal(false);
      const params = new URLSearchParams();
      params.set('job_id', res.job_id);
      params.set('code', selectedCodes.join(','));
      navigate(`/ai-debate?${params.toString()}`);
    } catch (e) {
      console.error('多选一任务启动失败:', e);
      setMultiError('启动多选一任务失败，请稍后重试');
    }
  };

  return (
    <div className="min-w-0">
      {/* 策略切换标签 */}
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          {STRATEGY_TABS.map((tab) => {
            const active = tab.key === strategyType;
            return (
              <button
                key={tab.key}
                onClick={() => setStrategyType(tab.key)}
                className={`inline-flex min-h-10 items-center border-b-2 px-4 text-sm font-medium transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 筛选结果标题和刷新按钮 - 根据策略切换 */}
      <div className="mb-4 w-full min-w-0">
        <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-1 sm:gap-3">
        <h2 className="min-w-0 shrink-0 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white sm:text-xl">
          {isStrongStocks && data && <span className="text-xs font-normal text-gray-500 dark:text-gray-400 sm:text-sm">共{data.count}只</span>}
          {isNineTurn && nineData && <span className="text-xs font-normal text-gray-500 dark:text-gray-400 sm:text-sm">共{nineData.count}只</span>}
        </h2>
        <div className="flex min-w-0 shrink-0 flex-nowrap items-center gap-1 sm:gap-3">
          {isStrongStocks && (
            <label className="flex shrink-0 items-center gap-1 text-sm text-gray-600 dark:text-gray-300 sm:gap-2">
              <span className="sm:hidden">截止</span>
              <span className="hidden sm:inline">涨停截止时间</span>
              <select
                value={limitTime}
                onChange={(e) => setLimitTime(e.target.value)}
                className="w-[76px] rounded-lg border border-gray-300 bg-white px-1 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-auto sm:px-3 sm:py-2"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </label>
          )}
          {isStrongStocks && selectedCodes.length >= 2 && (
            <button
              onClick={handleOpenMulti}
              className="flex items-center gap-1 rounded-lg bg-purple-600 px-1.5 py-1.5 text-[10px] text-white transition-colors hover:bg-purple-700 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
            >
              <span className="sm:hidden">AI</span><span className="hidden sm:inline">多选一 AI分析</span>
            </button>
          )}
          {isNineTurn && nineUpdatedAt > 0 && (
            <span className="shrink-0 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
              更新于 {new Date(nineUpdatedAt).toLocaleTimeString('zh-CN', { hour12: false })}
            </span>
          )}
          <button
            onClick={() => isStrongStocks ? refetch() : nineRefetch()}
            disabled={isStrongStocks ? isFetching : nineIsFetching}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-4 sm:py-2"
          >
            <svg className={`h-4 w-4 sm:h-5 sm:w-5 ${(isStrongStocks ? isFetching : nineIsFetching) ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="sm:hidden">{(isStrongStocks ? isFetching : nineIsFetching) ? '刷新中' : '刷新'}</span>
            <span className="hidden sm:inline">{(isStrongStocks ? isFetching : nineIsFetching) ? '刷新中...' : '刷新'}</span>
          </button>
        </div>
        </div>
      </div>

      {/* 二板分歧策略 - 股票列表 */}
      {isStrongStocks && (
        isLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
            <div className="flex flex-col items-center justify-center">
              <LoadingSpinner size="large" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">正在加载数据...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 className="text-red-800 dark:text-red-300 font-medium">加载数据失败</h3>
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{String(error)}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              重试
            </button>
          </div>
        ) : !data || data.stocks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="mt-2 text-gray-500 dark:text-gray-400">暂无符合条件的股票</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow">
            <p className="px-3 pt-3 mb-2 text-xs text-gray-500 dark:text-gray-400 lg:hidden">左右滑动表格，查看完整信息</p>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="可横向滚动的数据表格">
              <table className="min-w-full whitespace-nowrap divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">置信度</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">名称</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">所属板块</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">T-1/T-2</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">强度类型</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">250日振幅</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">突60日平台</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">当前价</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {data.stocks.map((stock) => {
                    const scoreColor = stock.score >= 80 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : stock.score >= 60 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : stock.score >= 40 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
                    const scoreLabel = stock.score >= 80 ? '重点关注' : stock.score >= 60 ? '适度参与' : stock.score >= 40 ? '一般' : '回避';
                    return (
                    <tr key={stock.code} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${scoreColor}`}>
                          {scoreLabel}
                        </span>
                      </td>
                      <td className="min-w-[150px] px-4 py-2.5 text-sm text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2 whitespace-nowrap font-medium">
                          <span>{stock.name}</span>
                          <span className={`text-xs font-semibold ${stock.change_percent == null ? 'text-gray-400 dark:text-gray-500' : stock.change_percent >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {stock.change_percent != null ? `${stock.change_percent >= 0 ? '+' : ''}${stock.change_percent.toFixed(2)}%` : '-'}
                          </span>
                          {stock.consecutive_days > 0 && (
                            <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 align-middle text-xs font-bold ${continuousBadgeClass(stock.consecutive_days)}`}>
                              {stock.consecutive_days}连板
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{stock.sector_name || stock.industry || '-'}</td>
                      <td className="px-4 py-2.5 text-sm">
                        <div className="whitespace-nowrap text-gray-600 dark:text-gray-300">
                          {formatLimitTime(stock.t1_limit_time)} / {formatLimitTime(stock.t2_limit_time)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                        {stock.strength_type ? (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${stock.strength_type === 'T字缩量' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : stock.strength_type === 'T字板' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : stock.strength_type === '缩量板' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                            {stock.strength_type}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {stock.amplitude_250 != null ? (<span className={stock.amplitude_250 >= 2.0 ? 'text-orange-500 font-medium' : ''}>{stock.amplitude_250}x</span>) : '-'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                        {stock.breakout_60 === null ? '-' : stock.breakout_60 ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">✓ 已突破</span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">未突破</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {stock.current_price ? `${stock.current_price.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" aria-label={`选择${stock.name}`} checked={selectedCodes.includes(stock.code)} onChange={() => toggleSelectCode(stock.code)} className="rounded" />
                          <Link to={`/stock/${stock.code}`} className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">详情</Link>
                          <button onClick={() => handleAddWatchlist(stock.code, stock.name)} disabled={addingMap[stock.code] || addedMap[stock.code]} className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {addedMap[stock.code] ? '已加入' : addingMap[stock.code] ? '加入中' : '加入自选'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* 九九归一 - 股票列表 */}
      {isNineTurn && (
        nineLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
            <div className="flex flex-col items-center justify-center">
              <LoadingSpinner size="large" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">正在扫描全市场，请稍候（约需1~2分钟）...</p>
            </div>
          </div>
        ) : nineError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 className="text-red-800 dark:text-red-300 font-medium">加载数据失败</h3>
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{String(nineError)}</p>
            <button onClick={() => nineRefetch()} className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">重试</button>
          </div>
        ) : !nineData || nineData.stocks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="mt-2 text-gray-500 dark:text-gray-400">暂无符合9转信号的股票</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow">
            <p className="px-3 pt-3 mb-2 text-xs text-gray-500 dark:text-gray-400 lg:hidden">左右滑动表格，查看完整信息</p>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="九九归一数据表格">
              <table className="min-w-full whitespace-nowrap divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">名称</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">信号</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">当前价</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">MA5</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {nineData.stocks.map((stock) => (
                    <tr key={stock.code} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="min-w-[150px] px-4 py-2.5 text-sm text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2 whitespace-nowrap font-medium">
                          <span>{stock.name}</span>
                          <span className={`text-xs font-semibold ${stock.change_percent == null ? 'text-gray-400 dark:text-gray-500' : stock.change_percent >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {stock.change_percent != null ? `${stock.change_percent >= 0 ? '+' : ''}${stock.change_percent.toFixed(2)}%` : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          stock.direction === 'buy'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {stock.direction_label} {stock.td_count}/9
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {stock.current_price ? `${stock.current_price.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                        {stock.ma5 != null ? (
                          <span className={stock.current_price != null && stock.current_price >= stock.ma5 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-green-600 dark:text-green-400 font-medium'}>
                            {stock.ma5.toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <Link to={`/stock/${stock.code}`} className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">详情</Link>
                          <button onClick={() => handleAddWatchlist(stock.code, stock.name)} disabled={addingMap[stock.code] || addedMap[stock.code]} className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {addedMap[stock.code] ? '已加入' : addingMap[stock.code] ? '加入中' : '加入自选'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* 多选一 模态 */}
      {showMultiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">多选一 AI分析</h2>
              <button
                onClick={() => {
                  setShowMultiModal(false);
                  setMultiError(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                本模式要求从所选股票中<strong>必须选择一只</strong>进行买入决策。
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  选择模式
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setMultiMode('fast')}
                    className={`px-3 py-2 rounded-lg text-sm border ${multiMode === 'fast'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                  >
                    快速模式
                    <div className="text-xs opacity-70">思考1 / 辩论1</div>
                  </button>
                  <button
                    onClick={() => setMultiMode('balanced')}
                    className={`px-3 py-2 rounded-lg text-sm border ${multiMode === 'balanced'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                  >
                    均衡模式
                    <div className="text-xs opacity-70">思考2 / 辩论1</div>
                  </button>
                  <button
                    onClick={() => setMultiMode('deep')}
                    className={`px-3 py-2 rounded-lg text-sm border ${multiMode === 'deep'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                  >
                    深入模式
                    <div className="text-xs opacity-70">思考3 / 辩论2</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  选择参与辩论的Agent（至少2个）
                </label>
                {agentsLoading ? (
                  <div className="text-gray-500">加载中...</div>
                ) : agents && agents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {agents.map((agent) => (
                      <label
                        key={agent.id}
                        className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAgentIds.includes(agent.id)}
                          onChange={() =>
                            setSelectedAgentIds((prev) =>
                              prev.includes(agent.id) ? prev.filter((id) => id !== agent.id) : [...prev, agent.id]
                            )
                          }
                          className="rounded"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {agent.name} ({agent.type})
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">暂无启用的Agent，请先在配置页面添加</div>
                )}
              </div>
              {multiError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm">
                  {multiError}
                </div>
              )}

              <button
                onClick={handleStartMulti}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold"
              >
                启动多选一分析
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
