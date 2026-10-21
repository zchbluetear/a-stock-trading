import { useState, useEffect, useCallback } from 'react';
import { stockAPI } from '../services/api';
import type { TradingLog, TradeAction, TradeTag, TradingLogStatistics } from '../services/api';

const defaultBuyForm = {
  code: '', name: '', buy_time: '', buy_price: '', buy_quantity: '', buy_logic: '',
};

const defaultActionForm = {
  action_type: 'buy' as 'buy' | 'sell',
  action_time: '', price: '', quantity: '', logic: '',
};

// 日期快捷选项
const getDateRange = (key: string): { from: string; to: string } => {
  const now = new Date();
  // 使用本地时间格式化，避免 UTC 时区偏移问题
  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const today = fmt(now);
  switch (key) {
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay() + 1);
      return { from: fmt(d), to: today };
    }
    case 'month': return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today };
    case '3month': {
      const d = new Date(now); d.setMonth(d.getMonth() - 3);
      return { from: fmt(d), to: today };
    }
    case 'year': return { from: `${now.getFullYear()}-01-01`, to: today };
    default: return { from: '', to: '' };
  }
};

export default function TradingLogs() {
  const [logs, setLogs] = useState<TradingLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tagFilter, setTagFilter] = useState<number | null>(null);

  // 分页
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // 统计
  const [stats, setStats] = useState<TradingLogStatistics | null>(null);

  // 标签
  const [allTags, setAllTags] = useState<TradeTag[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');

  // 新增买入表单
  const [isAdding, setIsAdding] = useState(false);
  const [buyForm, setBuyForm] = useState(defaultBuyForm);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 详情面板
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailActions, setDetailActions] = useState<TradeAction[]>([]);
  const [detailLog, setDetailLog] = useState<TradingLog | null>(null);
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionForm, setActionForm] = useState(defaultActionForm);
  const [detailTags, setDetailTags] = useState<TradeTag[]>([]);

  const showMsg = (ok: boolean, text: string) => {
    setSaveMsg({ ok, text });
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await stockAPI.getTradingLogs({
        status: statusFilter || undefined,
        code: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        tag_id: tagFilter || undefined,
        page,
        per_page: perPage,
      });
      setLogs(res.items);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, dateFrom, dateTo, tagFilter, page, perPage]);

  const loadStats = useCallback(async () => {
    try {
      const s = await stockAPI.getTradingStatistics({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        tag_id: tagFilter || undefined,
      });
      setStats(s);
    } catch { /* ignore */ }
  }, [dateFrom, dateTo, tagFilter]);

  const loadTags = useCallback(async () => {
    try {
      const tags = await stockAPI.getTradeTags();
      setAllTags(tags);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); loadStats(); }, [load, loadStats]);
  useEffect(() => { loadTags(); }, [loadTags]);

  // 筛选条件变化时重置到第一页
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, dateFrom, dateTo, tagFilter]);

  // 加载详情
  const loadDetail = useCallback(async (logId: number) => {
    try {
      const actions = await stockAPI.getTradeActions(logId);
      setDetailActions(actions);
      const log = logs.find(l => l.id === logId);
      setDetailLog(log || null);
      if (log) setDetailTags(log.tags || []);
    } catch { /* ignore */ }
  }, [logs]);

  const handleStartDetail = (item: TradingLog) => {
    setDetailId(item.id);
    setIsAdding(false);
    setShowActionForm(false);
    setActionForm(defaultActionForm);
    loadDetail(item.id);
  };

  // 新增买入
  const handleAdd = async () => {
    if (!buyForm.code.trim()) { showMsg(false, '股票代码不能为空'); return; }
    if (!buyForm.buy_time) { showMsg(false, '买入时间不能为空'); return; }
    if (!buyForm.buy_price) { showMsg(false, '买入价格不能为空'); return; }
    if (!buyForm.buy_quantity) { showMsg(false, '买入数量不能为空'); return; }
    setSaving(true);
    try {
      await stockAPI.createTradingLog({
        code: buyForm.code.trim(),
        name: buyForm.name.trim() || undefined,
        buy_time: buyForm.buy_time,
        buy_price: parseFloat(buyForm.buy_price),
        buy_quantity: parseInt(buyForm.buy_quantity),
        buy_logic: buyForm.buy_logic || undefined,
      });
      showMsg(true, '买入记录添加成功');
      setIsAdding(false);
      setBuyForm(defaultBuyForm);
      load(); loadStats();
    } catch (e) {
      showMsg(false, `添加失败: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // 追加分批买卖
  const handleAddAction = async () => {
    if (detailId === null) return;
    if (!actionForm.action_time) { showMsg(false, '时间不能为空'); return; }
    if (!actionForm.price) { showMsg(false, '价格不能为空'); return; }
    if (!actionForm.quantity) { showMsg(false, '数量不能为空'); return; }
    setSaving(true);
    try {
      await stockAPI.addTradeAction(detailId, {
        action_type: actionForm.action_type,
        action_time: actionForm.action_time,
        price: parseFloat(actionForm.price),
        quantity: parseInt(actionForm.quantity),
        logic: actionForm.logic || undefined,
      });
      showMsg(true, `${actionForm.action_type === 'buy' ? '买入' : '卖出'}操作添加成功`);
      setShowActionForm(false);
      setActionForm(defaultActionForm);
      loadDetail(detailId);
      load(); loadStats();
    } catch (e) {
      showMsg(false, `添加失败: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // 删除 action
  const handleDeleteAction = async (actionId: number) => {
    if (detailId === null) return;
    if (!window.confirm('确定删除此操作记录？')) return;
    try {
      await stockAPI.deleteTradeAction(detailId, actionId);
      showMsg(true, '操作已删除');
      loadDetail(detailId);
      load(); loadStats();
    } catch (e) {
      showMsg(false, `删除失败: ${(e as Error).message}`);
    }
  };

  // 删除交易
  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`确定要删除 ${name} 的交易记录吗？`)) return;
    try {
      await stockAPI.deleteTradingLog(id);
      showMsg(true, '删除成功');
      if (detailId === id) setDetailId(null);
      load(); loadStats();
    } catch (e) {
      showMsg(false, `删除失败: ${(e as Error).message}`);
    }
  };

  // 标签操作
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await stockAPI.createTradeTag({ name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      loadTags();
    } catch (e) {
      showMsg(false, `创建标签失败: ${(e as Error).message}`);
    }
  };

  const handleDeleteTag = async (id: number) => {
    try {
      await stockAPI.deleteTradeTag(id);
      if (tagFilter === id) setTagFilter(null);
      loadTags(); load();
    } catch { /* ignore */ }
  };

  const handleToggleLogTag = async (logId: number, tagId: number, has: boolean) => {
    try {
      if (has) await stockAPI.removeLogTag(logId, tagId);
      else await stockAPI.addLogTag(logId, tagId);
      load();
      if (detailId === logId) loadDetail(logId);
    } catch { /* ignore */ }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setBuyForm(defaultBuyForm);
  };

  const handleDateQuick = (key: string) => {
    const { from, to } = getDateRange(key);
    setDateFrom(from);
    setDateTo(to);
  };

  const formatTime = (t: string | null) => {
    if (!t) return '-';
    return t.replace('T', ' ').substring(0, 16);
  };

  const fmtNum = (n: number | null | undefined, decimals = 2) => {
    if (n == null) return '-';
    return n.toFixed(decimals);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        加载交易记录中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4 sm:p-6">
        <p className="font-semibold text-red-700 dark:text-red-400 mb-1">加载失败</p>
        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        <button onClick={load} className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">重试</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      {stats && stats.total_trades > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: '净盈亏', value: `${stats.net_profit >= 0 ? '+' : ''}${fmtNum(stats.net_profit)}`, color: stats.net_profit >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400' },
            { label: '胜率', value: `${stats.win_rate}%`, sub: `${stats.win_count}盈 / ${stats.loss_count}亏`, color: stats.win_rate >= 50 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300' },
            { label: '最大盈利', value: `+${fmtNum(stats.max_single_profit)}`, sub: stats.max_single_profit_name, color: 'text-red-600 dark:text-red-400' },
            { label: '最大亏损', value: `${fmtNum(stats.max_single_loss)}`, sub: stats.max_single_loss_name, color: 'text-green-600 dark:text-green-400' },
            { label: '平均持仓', value: `${stats.avg_holding_days}天`, sub: `共${stats.total_trades}笔`, color: 'text-gray-900 dark:text-white' },
          ].map((card, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{card.label}</p>
              <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
              {card.sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{card.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索代码 / 名称"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">全部</option>
          <option value="open">持仓中</option>
          <option value="closed">已清仓</option>
        </select>

        {/* 日期筛选 */}
        <div className="flex items-center gap-1">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="py-2 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
          <span className="text-gray-400 text-sm">~</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="py-2 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="flex gap-1">
          {['week', 'month', '3month', 'year'].map(k => (
            <button key={k} onClick={() => handleDateQuick(k)}
              className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
              {k === 'week' ? '本周' : k === 'month' ? '本月' : k === '3month' ? '近3月' : '今年'}
            </button>
          ))}
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              清除日期
            </button>
          )}
        </div>

        {/* 标签筛选 */}
        {allTags.length > 0 && (
          <select value={tagFilter || ''} onChange={e => setTagFilter(e.target.value ? Number(e.target.value) : null)}
            className="py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">全部标签</option>
            {allTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        <button onClick={load}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-gray-100 px-2 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 sm:px-3">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
        <button onClick={() => { setIsAdding(!isAdding); setDetailId(null); setBuyForm(defaultBuyForm); }}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-blue-600 px-2 py-2 text-sm text-white hover:bg-blue-700 sm:gap-1.5 sm:px-3">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新增买入
        </button>
        <button onClick={() => setShowTagManager(!showTagManager)}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-purple-600 px-2 py-2 text-sm text-white hover:bg-purple-700 sm:px-3">
          标签管理
        </button>
        <span className="hidden whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 sm:inline">共 {total} 条</span>
      </div>

      {/* 标签管理模态 */}
      {showTagManager && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-purple-200 dark:border-purple-800">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">标签管理</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-3">
            <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)}
              placeholder="标签名称" maxLength={10}
              className="w-full sm:w-auto px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-white" />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">颜色:</label>
              <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)}
                className="w-10 h-10 sm:w-8 sm:h-8 rounded cursor-pointer border border-gray-300 dark:border-gray-600 p-0.5" />
              <span className="text-xs text-gray-400 font-mono">{newTagColor}</span>
            </div>
            <button onClick={handleCreateTag}
              className="w-full sm:w-auto px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700">添加</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allTags.map(t => (
              <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-white"
                style={{ backgroundColor: t.color }}>
                {t.name}
                <button onClick={() => handleDeleteTag(t.id)} className="hover:opacity-70">×</button>
              </span>
            ))}
            {allTags.length === 0 && <span className="text-sm text-gray-400">暂无标签</span>}
          </div>
        </div>
      )}

      {/* 新增买入表单 */}
      {isAdding && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-blue-100 dark:border-blue-900">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">新增买入记录</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">股票代码*</label>
              <input type="text" value={buyForm.code} onChange={e => setBuyForm({ ...buyForm, code: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-white"
                placeholder="如: 600519" maxLength={6} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">股票名称</label>
              <input type="text" value={buyForm.name} onChange={e => setBuyForm({ ...buyForm, name: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-white"
                placeholder="如: 贵州茅台" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">买入时间*</label>
              <input type="datetime-local" value={buyForm.buy_time} onChange={e => setBuyForm({ ...buyForm, buy_time: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">买入价格*</label>
              <input type="number" step="0.01" value={buyForm.buy_price} onChange={e => setBuyForm({ ...buyForm, buy_price: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-white"
                placeholder="如: 1800.50" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">买入数量（股）*</label>
              <input type="number" value={buyForm.buy_quantity} onChange={e => setBuyForm({ ...buyForm, buy_quantity: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-white"
                placeholder="如: 100" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">买入逻辑 <span className="text-gray-400">({buyForm.buy_logic.length}/100)</span></label>
              <textarea maxLength={100} rows={2} value={buyForm.buy_logic} onChange={e => setBuyForm({ ...buyForm, buy_logic: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-white resize-none"
                placeholder="如: 突破均线放量买入" />
            </div>
          </div>
          <div className="flex items-end gap-2 mt-4">
            <button onClick={handleAdd} disabled={saving}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? '保存中' : '保存'}
            </button>
            <button onClick={handleCancel}
              className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 详情面板 */}
      {detailId !== null && detailLog && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-yellow-200 dark:border-yellow-800 space-y-4">
          {/* 区域 A：基本信息 */}
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {detailLog.name || '-'}（{detailLog.code}）- 交易详情
            </h3>
            <button onClick={() => setDetailId(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">关闭</button>
          </div>

          {/* 区域 C：持仓汇总 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">总买入</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{detailLog.buy_quantity}股</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">总卖出</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{detailLog.sell_quantity || 0}股</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">当前持仓</p>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{detailLog.holding_quantity ?? detailLog.buy_quantity}股</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">持仓均价</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{fmtNum(detailLog.buy_price)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">累计手续费</p>
              <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{fmtNum(detailLog.total_fee)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {detailLog.status === 'closed' ? '实现盈亏' : '浮动盈亏'}
              </p>
              <p className={`text-sm font-bold ${
                detailLog.profit_amount != null
                  ? detailLog.profit_amount >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {detailLog.net_profit != null
                  ? `${detailLog.net_profit >= 0 ? '+' : ''}${fmtNum(detailLog.net_profit)}`
                  : detailLog.profit_amount != null
                    ? `${detailLog.profit_amount >= 0 ? '+' : ''}${fmtNum(detailLog.profit_amount)}`
                    : '-'}
              </p>
            </div>
          </div>

          {/* 标签选择 */}
          {allTags.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">标签</p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => {
                  const has = detailTags.some(dt => dt.id === tag.id);
                  return (
                    <button key={tag.id} onClick={() => handleToggleLogTag(detailId, tag.id, has)}
                      className={`px-2 py-0.5 rounded-full text-xs transition-all ${
                        has ? 'text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 opacity-50'
                      }`}
                      style={has ? { backgroundColor: tag.color } : {}}>
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 区域 B：操作时间线 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">交易操作时间线</p>
              <div className="flex gap-2">
                <button onClick={() => { setActionForm({ ...defaultActionForm, action_type: 'buy' }); setShowActionForm(true); }}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">追加买入</button>
                {detailLog.status === 'open' && (
                  <button onClick={() => { setActionForm({ ...defaultActionForm, action_type: 'sell' }); setShowActionForm(true); }}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">追加卖出</button>
                )}
              </div>
            </div>

            {/* 追加表单 */}
            {showActionForm && (
              <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {actionForm.action_type === 'buy' ? '追加买入' : '追加卖出'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">时间*</label>
                    <input type="datetime-local" value={actionForm.action_time}
                      onChange={e => setActionForm({ ...actionForm, action_time: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">价格*</label>
                    <input type="number" step="0.01" value={actionForm.price}
                      onChange={e => setActionForm({ ...actionForm, price: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">数量（股）*</label>
                    <input type="number" value={actionForm.quantity}
                      onChange={e => setActionForm({ ...actionForm, quantity: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">逻辑 <span className="text-gray-400">({(actionForm.logic || '').length}/100)</span></label>
                    <textarea maxLength={100} rows={2} value={actionForm.logic}
                      onChange={e => setActionForm({ ...actionForm, logic: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-white resize-none" />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={handleAddAction} disabled={saving}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
                    {saving ? '保存中' : '确认添加'}
                  </button>
                  <button onClick={() => { setShowActionForm(false); setActionForm(defaultActionForm); }}
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded">
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 时间线列表 */}
            <div className="space-y-2">
              {detailActions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">暂无操作记录</p>
              ) : detailActions.map(action => (
                <div key={action.id} className="flex items-center gap-3 p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold ${
                    action.action_type === 'buy'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  }`}>
                    {action.action_type === 'buy' ? '买入' : '卖出'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-32">{formatTime(action.action_time)}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{fmtNum(action.price)} × {action.quantity}股</span>
                  <span className="text-xs text-yellow-600 dark:text-yellow-400">费{fmtNum(action.fee)}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1" title={action.logic || ''}>
                    {action.logic || ''}
                  </span>
                  <button onClick={() => handleDeleteAction(action.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0" title="删除">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {saveMsg && (
        <div className={`px-4 py-2 rounded-lg text-sm ${saveMsg.ok
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700'
          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700'
          }`}>
          {saveMsg.ok ? '✓ ' : '✗ '}{saveMsg.text}
        </div>
      )}

      {/* 表格 */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
        <p className="px-3 pt-3 mb-2 text-xs text-gray-500 dark:text-gray-400 lg:hidden">左右滑动表格，查看完整信息</p>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="可横向滚动的数据表格">
          <table className="w-full min-w-[1100px] whitespace-nowrap divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">股票名称</th>
                <th className="px-4 py-3 text-center text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">标签</th>
                <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">买入时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">买入价</th>
                <th className="px-4 py-3 text-right text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">持仓/总量</th>
                <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">买入逻辑</th>
                <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">卖出时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">卖出价</th>
                <th className="px-4 py-3 text-right text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">手续费</th>
                <th className="px-4 py-3 text-right text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">净盈亏</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {logs.length === 0 ? (
                <tr><td colSpan={12} className="py-12 text-center text-gray-400 dark:text-gray-500">暂无交易记录</td></tr>
              ) : logs.map((item) => {
                const profitColor = item.net_profit != null
                  ? item.net_profit >= 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                  : item.profit_amount != null
                    ? item.profit_amount >= 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                    : '';
                const displayProfit = item.net_profit ?? item.profit_amount;
                return (
                  <tr key={item.id} className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${detailId === item.id ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                      <span className="font-bold">{item.name || '-'}（{item.code}）</span>
                    </td>
                    <td className="px-4 py-4 text-center text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.status === 'open'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}>
                        {item.status === 'open' ? '持仓中' : '已清仓'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {(item.tags || []).map(t => (
                          <span key={t.id} className="px-1.5 py-0.5 rounded text-xs text-white" style={{ backgroundColor: t.color }}>
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{formatTime(item.buy_time)}</td>
                    <td className="px-4 py-4 text-right text-sm text-gray-900 dark:text-white font-medium">{item.buy_price?.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-sm text-gray-500 dark:text-gray-400">
                      {item.holding_quantity ?? item.buy_quantity}/{item.buy_quantity}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-[120px] truncate" title={item.buy_logic || ''}>
                      {item.buy_logic || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{formatTime(item.sell_time)}</td>
                    <td className="px-4 py-4 text-right text-sm text-gray-900 dark:text-white font-medium">
                      {item.sell_price != null ? item.sell_price.toFixed(2) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                      {fmtNum(item.total_fee)}
                    </td>
                    <td className={`px-4 py-4 text-right text-sm font-bold ${profitColor}`}>
                      {displayProfit != null ? (
                        <>
                          {displayProfit >= 0 ? '+' : ''}{displayProfit.toFixed(2)}
                          {item.profit_percent != null && (
                            <span className="ml-1 text-xs">({item.profit_percent >= 0 ? '+' : ''}{item.profit_percent.toFixed(2)}%)</span>
                          )}
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-sm">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleStartDetail(item)}
                          className="text-gray-400 hover:text-yellow-500 transition-colors p-1" title="详情/分批操作">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(item.id, item.name || item.code)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1" title="删除">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 分页控件 */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
              共 <span className="font-semibold">{total}</span> 条记录
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              {/* 每页显示数量 */}
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="w-full sm:w-auto px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={5}>5条/页</option>
                <option value={10}>10条/页</option>
                <option value={20}>20条/页</option>
              </select>

              {/* 分页按钮 */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <span className="hidden sm:inline">首页</span>
                  <span className="sm:hidden">首</span>
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <span className="hidden sm:inline">上一页</span>
                  <span className="sm:hidden">◀</span>
                </button>
                <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {page}/{Math.ceil(total / perPage)}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / perPage), p + 1))}
                  disabled={page >= Math.ceil(total / perPage)}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <span className="hidden sm:inline">下一页</span>
                  <span className="sm:hidden">▶</span>
                </button>
                <button
                  onClick={() => setPage(Math.ceil(total / perPage))}
                  disabled={page >= Math.ceil(total / perPage)}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <span className="hidden sm:inline">末页</span>
                  <span className="sm:hidden">末</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
