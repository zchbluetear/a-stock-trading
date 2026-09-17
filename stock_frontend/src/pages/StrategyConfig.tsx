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
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-6">
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
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
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
          className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1.5"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400">共 {configs.length} 项</span>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 w-1/4">参数名 (cfg_key)</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 w-1/4">当前值 (cfg_value)</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">说明</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400 dark:text-gray-500">暂无匹配数据</td>
              </tr>
            ) : filtered.map((item, idx) => {
              const isEditing = editRow?.cfg_key === item.cfg_key;
              return (
                <tr
                  key={item.cfg_key}
                  className={`border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors ${isEditing
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750'
                  }`}
                >
                  {/* cfg_key */}
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                      {item.cfg_key}
                    </code>
                  </td>

                  {/* cfg_value */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editRow.draft}
                        onChange={e => setEditRow({ ...editRow, draft: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        autoFocus
                        className="w-full px-2 py-1 border border-blue-400 dark:border-blue-500 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-900 dark:text-white"
                      />
                    ) : (
                      <span className="font-mono text-gray-900 dark:text-white">{item.cfg_value}</span>
                    )}
                  </td>

                  {/* description */}
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {item.description ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                  </td>

                  {/* 操作 */}
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={commitEdit}
                          disabled={saving}
                          className="px-2.5 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving ? '…' : '保存'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="px-2.5 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
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
  );
}
