import { useState, useEffect, useCallback } from 'react';
import { stockAPI } from '../services/api';
import type { StrategyStockConfigItem } from '../services/api';

export default function StrategyToggle() {
  const [configs, setConfigs] = useState<StrategyStockConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // State for adding new config
  const [isAdding, setIsAdding] = useState(false);
  const [newConfig, setNewConfig] = useState({
    stock_code: '',
    stock_name: '',
    strategy_type: 'short',
    strategy_enabled: 1,
    paused: 0
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await stockAPI.getStrategyStockConfigs();
      setConfigs(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showMsg = (ok: boolean, text: string) => {
    setSaveMsg({ ok, text });
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const handleToggle = async (id: number, field: 'strategy_enabled' | 'paused', currentValue: number) => {
    try {
      const newValue = currentValue === 1 ? 0 : 1;
      await stockAPI.updateStrategyStockConfig(id, { [field]: newValue });
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: newValue } : c));
      showMsg(true, '状态已更新');
    } catch (e) {
      showMsg(false, `更新失败: ${(e as Error).message}`);
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (!window.confirm(`确定要删除股票 ${code} 的策略配置吗？`)) return;
    try {
      await stockAPI.deleteStrategyStockConfig(id);
      setConfigs(prev => prev.filter(c => c.id !== id));
      showMsg(true, '删除成功');
    } catch (e) {
      showMsg(false, `删除失败: ${(e as Error).message}`);
    }
  };

  const handleAdd = async () => {
    if (!newConfig.stock_code.trim()) {
      showMsg(false, '股票代码不能为空');
      return;
    }
    setSaving(true);
    try {
      await stockAPI.addStrategyStockConfig(newConfig);
      showMsg(true, '添加成功');
      setIsAdding(false);
      setNewConfig({
        stock_code: '',
        stock_name: '',
        strategy_type: 'short',
        strategy_enabled: 1,
        paused: 0
      });
      load();
    } catch (e) {
      showMsg(false, `添加失败: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const filtered = configs.filter(c =>
    !search ||
    c.stock_code.toLowerCase().includes(search.toLowerCase()) ||
    (c.stock_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        加载策略配置中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-6">
        <p className="font-semibold text-red-700 dark:text-red-400 mb-1">加载失败</p>
        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        <button
          onClick={load}
          className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索股票代码 / 名称…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button
          onClick={load}
          className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1.5"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新增配置
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400">共 {configs.length} 项</span>
      </div>

      {/* 新增配置表单 */}
      {isAdding && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-blue-100 dark:border-blue-900">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">新增股票策略</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">股票代码*</label>
              <input
                type="text"
                value={newConfig.stock_code}
                onChange={e => setNewConfig({ ...newConfig, stock_code: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-white"
                placeholder="如: 600519.SH"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">股票名称</label>
              <input
                type="text"
                value={newConfig.stock_name}
                onChange={e => setNewConfig({ ...newConfig, stock_name: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-white"
                placeholder="如: 贵州茅台"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">策略类型</label>
              <input
                type="text"
                value={newConfig.strategy_type}
                onChange={e => setNewConfig({ ...newConfig, strategy_type: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-white"
                placeholder="short"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中' : '保存'}
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                取消
              </button>
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

      {/* 表格 (无背景扁平化风格) */}
      <div className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">股票代码</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">股票名称</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">策略类型</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">策略开启</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">是否暂停</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">更新时间</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-500">暂无数据</td>
              </tr>
            ) : filtered.map((item) => (
              <tr
                key={item.id}
                className="border-b border-gray-200 dark:border-gray-700 last:border-0 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <code className="text-xs font-mono text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                    {item.stock_code}
                  </code>
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">
                  {item.stock_name || '-'}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                    {item.strategy_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggle(item.id, 'strategy_enabled', item.strategy_enabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${item.strategy_enabled === 1 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${item.strategy_enabled === 1 ? 'translate-x-5' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggle(item.id, 'paused', item.paused)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${item.paused === 1 ? 'bg-yellow-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${item.paused === 1 ? 'translate-x-5' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
                  {item.updated_at
                    ? new Date(item.updated_at).toLocaleString('zh-CN', {
                      timeZone: 'UTC',
                      hour12: false,
                    })
                    : '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(item.id, item.stock_code)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
