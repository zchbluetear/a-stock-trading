import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useWatchlistStore } from '../store/watchlistStore';
import { stockAPI } from '../services/api';
import AIAnalyzeButton from '../components/AIAnalyzeButton';
import type { Agent } from '../services/api';
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

export default function Watchlist() {
  const { items, loading, addStock, removeStock, fetchWatchlist } = useWatchlistStore();
  const [codeInput, setCodeInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [multiMode, setMultiMode] = useState<'fast' | 'balanced' | 'deep'>('fast');
  const [multiError, setMultiError] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents', 'enabled'],
    queryFn: () => stockAPI.getAgents(true),
    enabled: showMultiModal,
  });

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  useEffect(() => {
    if (showMultiModal && agents && agents.length > 0 && selectedAgentIds.length === 0) {
      setSelectedAgentIds(agents.map((agent) => agent.id));
    }
  }, [showMultiModal, agents, selectedAgentIds.length]);

  const handleAdd = async () => {
    const code = codeInput.trim();
    if (!code || code.length !== 6) {
      alert('请输入6位股票代码');
      return;
    }

    setAdding(true);
    try {
      // 先获取股票名称
      const realtime = await stockAPI.getRealtime(code);
      await addStock(code, realtime.name);
      setCodeInput('');
    } catch (error) {
      alert(`添加失败: ${(error as Error).message}`);
    } finally {
      setAdding(false);
    }
  };

  const toggleSelectCode = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleOpenMulti = () => {
    if (selectedCodes.length < 2) {
      setMultiError('请至少勾选2只股票');
      return;
    }
    setMultiError(null);
    setShowMultiModal(true);
  };

  const [refreshingVol, setRefreshingVol] = useState(false);
  const handleRefreshVolumePrediction = async () => {
    if (refreshingVol) return;
    setRefreshingVol(true);
    try {
      await stockAPI.refreshVolumePrediction();
      // 重新拉取自选股列表（会带最新的 volume_prediction）
      await fetchWatchlist();
    } catch (e) {
      console.error('刷新成交量预测失败:', e);
      alert('刷新成交量预测失败：' + ((e as Error).message || '未知错误'));
    } finally {
      setRefreshingVol(false);
    }
  };

  const [refreshingSingle, setRefreshingSingle] = useState<string | null>(null);
  const handleRefreshSingleVolumePrediction = async (code: string) => {
    if (refreshingSingle) return;
    setRefreshingSingle(code);
    try {
      await stockAPI.refreshSingleVolumePrediction(code);
      await fetchWatchlist();
    } catch (e) {
      console.error(`单只刷新成交量预测失败 ${code}:`, e);
      alert('刷新失败：' + ((e as Error).message || '未知错误'));
    } finally {
      setRefreshingSingle(null);
    }
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">自选股管理</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRefreshVolumePrediction}
            disabled={refreshingVol}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {refreshingVol ? '计算中...' : '全部刷新成交量预测'}
          </button>
          {selectedCodes.length >= 2 && (
            <button
              onClick={handleOpenMulti}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              多选一 AI分析
            </button>
          )}
        </div>
      </div>

      {/* 添加自选股 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">添加自选股</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="输入6位股票代码，如：000001"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            maxLength={6}
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? '添加中...' : '添加'}
          </button>
        </div>
      </div>

      {/* 自选股列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">我的自选</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无自选股</div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <WatchlistItem
                  key={item.id}
                  item={item}
                  onRemove={() => removeStock(item.code)}
                  selected={selectedCodes.includes(item.code)}
                  onToggleSelect={() => toggleSelectCode(item.code)}
                  onRefreshSingle={handleRefreshSingleVolumePrediction}
                  refreshingSingle={refreshingSingle}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 多选一 模态 */}
      {showMultiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
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
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                    className={`px-3 py-2 rounded-lg text-sm border ${
                      multiMode === 'fast'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    快速模式
                    <div className="text-xs opacity-70">思考1 / 辩论1</div>
                  </button>
                  <button
                    onClick={() => setMultiMode('balanced')}
                    className={`px-3 py-2 rounded-lg text-sm border ${
                      multiMode === 'balanced'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    均衡模式
                    <div className="text-xs opacity-70">思考2 / 辩论1</div>
                  </button>
                  <button
                    onClick={() => setMultiMode('deep')}
                    className={`px-3 py-2 rounded-lg text-sm border ${
                      multiMode === 'deep'
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
                    {agents.map((agent: Agent) => (
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

function WatchlistItem({
  item,
  onRemove,
  selected,
  onToggleSelect,
  onRefreshSingle,
  refreshingSingle,
}: {
  item: any;
  onRemove: () => void;
  selected: boolean;
  onToggleSelect: () => void;
  onRefreshSingle: (code: string) => Promise<void>;
  refreshingSingle: string | null;
}) {
  // 获取实时行情数据
  const { data: realtimeData, isLoading } = useQuery({
    queryKey: ['realtime', item.code],
    queryFn: () => stockAPI.getRealtime(item.code),
    refetchInterval: getRefetchInterval(),
    enabled: !!item.code,
  });

  const changePercent = realtimeData?.change_percent ?? 0;
  const changeValue = realtimeData?.current_price && realtimeData?.yesterday_close
    ? realtimeData.current_price - realtimeData.yesterday_close
    : 0;
  const isUp = changePercent >= 0;
  
  const volumePrediction = item.volume_prediction as {
    predicted_vol?: number;
    today_actual_vol?: number;
    avg_5d_vol?: number;
    change_pct?: number;
    vol_15min?: number;
  } | null | undefined;
  
  /**
   * 新浪返回的成交量单位是「股」。
   * A 股常用单位是「手」，1 手 = 100 股；1 万手 = 1,000,000 股；1 亿手 = 100,000,000 股。
   */
  const formatVolume = (v?: number) => {
    if (v == null || isNaN(v) || v <= 0) return '--';
    // 1手 = 100股
    const hands = v / 100;
    if (hands >= 100000000) return `${(hands / 100000000).toFixed(2)}亿手`; // 1亿手+
    if (hands >= 10000) return `${(hands / 10000).toFixed(2)}万手`;         // 1万手+
    if (hands >= 1) return `${hands.toFixed(0)}手`;                           // 1手+
    return `${hands.toFixed(2)}手`;
  };

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <div className="mr-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="rounded"
        />
      </div>
      <Link to={`/stock/${item.code}`} className="flex-1 flex items-center justify-between">
        <div className="flex-1">
          <div className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
            {item.name || item.code}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{item.code}</div>
          {/* 成交量预测：在"自选"列（名称列）下方显示 */}
          {volumePrediction && ((volumePrediction.predicted_vol ?? 0) > 0 || (volumePrediction.today_actual_vol ?? 0) > 0) ? (
            <div className="mt-1 text-xs flex items-center gap-2 flex-wrap">
              {(volumePrediction.today_actual_vol ?? 0) > 0 ? (
                <>
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    今日实量:{formatVolume(volumePrediction.today_actual_vol)}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 font-medium">|</span>
                </>
              ) : null}
              <span className="text-gray-600 dark:text-gray-300 font-medium">
                预测量:{formatVolume(volumePrediction.predicted_vol)}
              </span>
              <span className="text-gray-400 dark:text-gray-500 font-medium">/</span>
              <span className="text-gray-600 dark:text-gray-300 font-medium">
                5日均:{formatVolume(volumePrediction.avg_5d_vol)}
              </span>
              <span
                className={`font-semibold px-1.5 py-0.5 rounded ${
                  (volumePrediction.change_pct ?? 0) >= 0
                    ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                    : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                }`}
              >
                {(volumePrediction.change_pct ?? 0) >= 0 ? '+' : ''}
                {(volumePrediction.change_pct ?? 0).toFixed(1)}%
              </span>
            </div>
          ) : null}
        </div>

        {/* 实时行情信息 */}
        {isLoading ? (
          <div className="text-gray-400 text-sm">加载中...</div>
        ) : realtimeData ? (
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className={`text-lg font-bold ${isUp ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {realtimeData.current_price?.toFixed(2) || '--'}
              </div>
            </div>
            <div>
              <div className={`text-sm font-semibold ${isUp ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {isUp ? '+' : ''}{changePercent.toFixed(2)}%
              </div>
              <div className={`text-xs ${isUp ? 'text-red-500 dark:text-red-500' : 'text-green-500 dark:text-green-500'}`}>
                {isUp ? '+' : ''}{changeValue.toFixed(2)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-sm">--</div>
        )}
      </Link>

      <div className="ml-4 flex items-center gap-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            onRefreshSingle(item.code);
          }}
          disabled={refreshingSingle === item.code}
          title="刷新这只股票的成交量预测"
          className="px-2.5 py-1.5 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshingSingle === item.code ? (
            <span className="text-xs font-medium">计算中…</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
          )}
        </button>
        <AIAnalyzeButton code={item.code} className="text-sm px-3 py-1.5" />
        <button
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
          className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          删除
        </button>
      </div>
    </div>
  );
}

