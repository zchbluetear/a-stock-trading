import { useState, useEffect, useCallback } from 'react';
import { stockAPI } from '../services/api';
import type { StrategyGlobalConfigItem } from '../services/api';

/** 单行编辑态 */
interface EditRow {
  cfg_key: string;
  draft: string;
}

export default function StrategyConfig() {
  const [configs, setConfigs] = useState<StrategyGlobalConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<EditRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await stockAPI.getStrategyGlobalConfigs();
      setConfigs(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (item: StrategyGlobalConfigItem) => {
    setEditRow({ cfg_key: item.cfg_key, draft: item.cfg_value });
    setSaveMsg(null);
  };

  const cancelEdit = () => setEditRow(null);

  const commitEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await stockAPI.updateStrategyGlobalConfig(editRow.cfg_key, editRow.draft);
      setConfigs(prev =>
        prev.map(c => c.cfg_key === editRow.cfg_key ? { ...c, cfg_value: editRow.draft } : c)
      );
      setSaveMsg({ ok: true, text: `已保存 ${editRow.cfg_key}` });
      setEditRow(null);
    } catch (e) {
      setSaveMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const filtered = configs.filter(c =>
    !search ||
    c.cfg_key.toLowerCase().includes(search.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        加载策略参数中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4 sm:p-6">
        <p className="font-semibold text-red-700 dark:text-red-400 mb-1">连接 MySQL 失败</p>
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
      <div className="flex flex-nowrap items-center gap-2 sm:gap-3">
        <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索参数名 / 描述…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button
          onClick={load}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-gray-100 px-2 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 sm:gap-1.5 sm:px-3"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
        <span className="shrink-0 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 sm:text-sm">共 {configs.length} 项</span>
      </div>

      {/* 保存提示 */}
      {saveMsg && (
        <div className={`px-4 py-2 rounded-lg text-sm ${saveMsg.ok
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700'
          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700'
        }`}>
          {saveMsg.ok ? '✓ ' : '✗ '}{saveMsg.text}
        </div>
      )}

      {/* 表格 */}
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
        <p className="px-3 pt-3 mb-2 text-xs text-gray-500 dark:text-gray-400 lg:hidden">左右滑动表格，查看完整信息</p>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="可横向滚动的数据表格">
          <table className="w-full min-w-[600px] table-fixed whitespace-nowrap divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="w-[30%] px-4 py-3 text-left text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">字段</th>
                <th className="w-[25%] px-4 py-3 text-left text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">当前值</th>
                <th className="w-[45%] px-4 py-3 text-left text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">操作</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {filtered.length === 0 ? (
              <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-400 dark:text-gray-500">暂无匹配数据</td>
              </tr>
            ) : filtered.map((item, idx) => {
              const isEditing = editRow?.cfg_key === item.cfg_key;
              return (
                <tr
                  key={item.cfg_key}
                  className={`transition-colors ${isEditing
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {/* 字段 */}
                  <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {item.description ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                  </td>

                  {/* 当前值 */}
                  <td className="px-4 py-2 text-sm">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editRow.draft}
                        onChange={e => setEditRow({ ...editRow, draft: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        autoFocus
                        className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-500 dark:bg-gray-900 dark:text-white"
                      />
                    ) : (
                      <span className="font-mono text-gray-900 dark:text-white">{item.cfg_value}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-left text-sm">
                    {isEditing ? (
                      <div className="flex flex-nowrap gap-1.5 whitespace-nowrap">
                        <button
                          onClick={commitEdit}
                          disabled={saving}
                          className="inline-flex h-6 items-center justify-center rounded bg-green-600 px-2.5 text-xs leading-none text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving ? '…' : '保存'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="inline-flex h-6 items-center justify-center rounded bg-gray-200 px-2.5 text-xs leading-none text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        className="inline-flex h-6 items-center justify-center rounded bg-blue-600 px-2.5 text-xs leading-none text-white hover:bg-blue-700"
                      >
                        编辑
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
