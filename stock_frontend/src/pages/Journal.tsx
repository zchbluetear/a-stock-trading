import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stockAPI, JOURNAL_MAX_LEN } from '../services/api';
import type { Journal, JournalType } from '../services/api';

interface JournalPageProps {
  type: JournalType;
  title: string;
  placeholder: string;
  hint: string;
}

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const PAGE_SIZE = 5;

function EyeIcon({ closed }: { closed: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      {closed ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
        />
      ) : (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </>
      )}
    </svg>
  );
}

const inputClass =
  'min-w-0 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ' +
  'text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ' +
  'dark:border-gray-600 dark:bg-gray-700 dark:text-white';

interface EditorProps {
  type: JournalType;
  date: string;
  initialContent: string;
  initialSavedAt: string | null;
  placeholder: string;
  onSaved: (saved: Journal) => void;
  onError: (message: string) => void;
}

/** 编辑器按 date 作为 key 重挂载，因此无需 effect 同步外部数据到本地 state */
function JournalEditor({
  type, date, initialContent, initialSavedAt, placeholder, onSaved, onError,
}: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const [savedAt, setSavedAt] = useState(initialSavedAt);

  const save = useMutation({
    mutationFn: () => stockAPI.saveJournal(type, date, content),
    onSuccess: (data) => {
      setSavedAt(data.updated_at ?? null);
      onSaved(data);
    },
    onError: (e: Error) => onError(e.message),
  });

  const remaining = JOURNAL_MAX_LEN - content.length;

  return (
    <>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={JOURNAL_MAX_LEN}
        rows={10}
        placeholder={placeholder}
        aria-label="内容"
        className="w-full min-w-0 max-w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        style={{ font: 'inherit' }}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-gray-400 dark:text-gray-500">
          {savedAt ? `上次保存 ${savedAt}` : content ? '尚未保存' : '这一天还没有记录'}
        </span>
        <span
          className={`shrink-0 text-sm ${remaining <= 50
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-500 dark:text-gray-400'
            }`}
        >
          {content.length}/{JOURNAL_MAX_LEN}
        </span>
      </div>
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {save.isPending ? '保存中...' : '保存'}
      </button>
    </>
  );
}

export default function JournalPage({ type, title, placeholder, hint }: JournalPageProps) {
  const [date, setDate] = useState(todayStr());
  // 当前撑开查看全文的记录 id，null 表示全部收起
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // 删除当前正在查看的记录时自增，强制编辑器重挂载清空
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: journal, isLoading } = useQuery({
    queryKey: ['journal', type, date],
    queryFn: () => stockAPI.getJournal(type, date),
  });

  const {
    data: history,
    isLoading: historyLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['journals', type],
    queryFn: ({ pageParam }) => stockAPI.listJournals(type, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
  });
  const historyItems = history?.pages.flatMap((p) => p.items) ?? [];
  const historyTotal = history?.pages[0]?.total ?? 0;

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), ok ? 2500 : 4000);
  };

  const remove = useMutation({
    mutationFn: (id: number) => stockAPI.deleteJournal(id),
    onSuccess: (_d, id) => {
      flash(true, '已删除');
      queryClient.invalidateQueries({ queryKey: ['journals', type] });
      if (journal?.id === id) {
        // 删的是当前正在看的这一天：把缓存置回空草稿并让编辑器重挂载
        queryClient.setQueryData(['journal', type, date], {
          journal_type: type, date, content: '', exists: false,
        });
        setEditorEpoch((e) => e + 1);
      }
    },
    onError: (e: Error) => flash(false, e.message),
  });

  const handleDelete = (id: number | undefined, d: string) => {
    if (!id) return;
    if (!window.confirm(`确定要删除 ${d} 的${title}吗？`)) return;
    remove.mutate(id);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
      </div>

      {msg && (
        // 固定浮层而非文档流内元素：出现/消失不推移表单布局，避免连点时点错位置
        <div
          role="status"
          className={`fixed right-4 top-4 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg ${msg.ok
            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/90 dark:text-green-300'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/90 dark:text-red-300'
            }`}
        >
          {msg.text}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="shrink-0 text-sm text-gray-600 dark:text-gray-300" htmlFor={`journal-date-${type}`}>
            日期
          </label>
          <input
            id={`journal-date-${type}`}
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={`${inputClass} sm:w-auto`}
            style={{ font: 'inherit' }}
          />
          <button
            onClick={() => setDate(todayStr())}
            className="min-h-11 rounded-lg bg-gray-100 px-4 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 sm:min-h-0 sm:py-2"
          >
            今天
          </button>
        </div>

        <div className="mt-3">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-gray-400">加载中...</p>
          ) : (
            <JournalEditor
              key={`${date}#${editorEpoch}`}
              type={type}
              date={date}
              initialContent={journal?.content ?? ''}
              initialSavedAt={journal?.exists ? journal.updated_at ?? null : null}
              placeholder={placeholder}
              onSaved={(saved) => {
                flash(true, '已保存');
                // 立即写回缓存，否则切换日期再切回来会读到保存前的旧数据。
                // PUT 响应不含 exists 字段，补上以免状态行误报"尚未保存"
                queryClient.setQueryData(['journal', type, date], { ...saved, exists: true });
                queryClient.invalidateQueries({ queryKey: ['journals', type] });
              }}
              onError={(m) => flash(false, m)}
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          最近记录
          {history && <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">共 {historyTotal} 条</span>}
        </h2>

        {historyLoading ? (
          <p className="py-6 text-center text-sm text-gray-400">加载中...</p>
        ) : historyItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">暂无记录</p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
              {historyItems.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2 py-3">
                  <button
                    onClick={() => setDate(item.date)}
                    className="min-w-0 flex-1 text-left"
                    title={expandedId === item.id ? undefined : item.content || undefined}
                  >
                    <span className={`block text-sm font-medium ${item.date === date
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400'
                      }`}>
                      {item.date}
                    </span>
                    {/* 保留换行并截真实的前两行；撑开时取消截断显示全文 */}
                    <span className={`mt-0.5 break-words whitespace-pre-line text-sm text-gray-500 dark:text-gray-400 ${expandedId === item.id ? '' : 'line-clamp-2'
                      }`}>
                      {item.content || '（空）'}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      aria-label={expandedId === item.id ? '收起全文' : '查看全文'}
                      aria-expanded={expandedId === item.id}
                      className="flex min-h-11 items-center justify-center rounded-lg px-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 sm:min-h-0 sm:py-2"
                    >
                      <EyeIcon closed={expandedId === item.id} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.date)}
                      disabled={remove.isPending}
                      aria-label={`删除 ${item.date} 的记录`}
                      className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20 sm:min-h-0 sm:py-2"
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {hasNextPage && (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg bg-gray-100 px-4 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                {isFetchingNextPage ? '加载中...' : `加载更多（已显示 ${historyItems.length}/${historyTotal}）`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
