import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { stockAPI } from '../services/api';
import type { MoverStock } from '../services/api';
import './MarketMovers.css';

type Grouping = 'industry' | 'concept';
type Filter = 'limit' | 'gainers';
const dateTime = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const money = (value: number | null) => value === null ? '—' : value >= 1e8 ? `${(value / 1e8).toFixed(2)} 亿` : `${(value / 1e4).toFixed(0)} 万`;

export default function MarketMovers() {
  const [paused, setPaused] = useState(false);
  const [grouping, setGrouping] = useState<Grouping>('industry');
  const [filter, setFilter] = useState<Filter>('limit');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['market-movers'], queryFn: () => stockAPI.getMarketMovers(),
    refetchInterval: paused ? false : 60000, refetchIntervalInBackground: true,
    staleTime: 0, retry: false,
  });
  const snapshot = data?.snapshot;
  const { groups, matching } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const grouped = new Map<string, MoverStock[]>();
    const matching: MoverStock[] = [];
    for (const stock of snapshot?.stocks ?? []) {
      if (filter === 'limit' && !stock.limit_up) continue;
      if (filter === 'gainers' && stock.change_percent < 5) continue;
      const names = grouping === 'industry' ? [stock.industry] : stock.concepts;
      const stockMatches = [stock.code, stock.name].some(v => v.toLowerCase().includes(query));
      const matchedNames = query && !stockMatches ? names.filter(v => v.toLowerCase().includes(query)) : names;
      if (!matchedNames.length) continue;
      matching.push(stock);
      for (const name of matchedNames) {
        if (!grouped.has(name)) grouped.set(name, []);
        grouped.get(name)!.push(stock);
      }
    }
    const groups = [...grouped].map(([name, stocks]) => ({ name, stocks, limits: stocks.filter(s => s.limit_up).length }));
    groups.sort((a, b) => b.stocks.length - a.stocks.length || b.limits - a.limits || a.name.localeCompare(b.name, 'zh'));
    return { groups, matching };
  }, [snapshot, grouping, filter, search]);
  const visible = selected ? groups.find(g => g.name === selected)?.stocks ?? [] : matching;
  const maxPage = Math.max(1, Math.ceil(visible.length / 40));
  const currentPage = Math.min(page, maxPage);
  const displayed = visible.slice((currentPage - 1) * 40, currentPage * 40);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const oldQuotes = snapshot && snapshot.quote_dates.some(day => day !== today);

  return <div className="market-movers space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">板块强势股</h1>
      </div>
      <div className="mm-actions flex gap-2">
        <button className="mm-secondary" onClick={() => setPaused(v => !v)}>{paused ? '恢复自动刷新' : '暂停自动刷新'}</button>
        <button className="mm-primary" disabled={isFetching} onClick={() => refetch()}>{isFetching ? '读取中…' : '刷新结果'}</button>
      </div>
    </header>
    <div className="mm-stats grid grid-cols-3 gap-2 sm:gap-3">
      {[
        ['扫描股票', snapshot?.total.toLocaleString() ?? '—'],
        ['涨停股票', snapshot?.limit_up_count ?? '—'],
        ['涨幅 ≥5%', snapshot?.gainer_count ?? '—'],
      ].map(([label, value]) => <div key={label} className="mm-card p-4"><div className="text-sm text-gray-500 dark:text-gray-400">{label}</div><div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value}</div></div>)}
    </div>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
      <span>{paused ? '自动刷新已暂停' : data?.refreshing ? '正在扫描全市场…' : '自动刷新中'}{data?.scan_seconds != null && ` · 上轮扫描 ${data.scan_seconds} 秒`}</span>
      <span>{snapshot ? `获取于 ${dateTime(snapshot.fetched_at)}` : '首次扫描需加载全市场行情和涨停价，请稍候'}</span>
    </div>
    {(error || data?.error || (data?.stale && snapshot) || oldQuotes) && <div role="alert" className="mm-warning">
      {error ? `读取失败：${error.message}。` : data?.error ? `${data.error} ` : ''}
      {snapshot && (error || data?.error || data?.stale) ? '当前保留上次成功数据。' : ''}
      {oldQuotes ? `数据包含历史行情（${snapshot.quote_dates.join('、')}），不代表今日实时行情。` : ''}
    </div>}
    <section className="mm-filters mm-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mm-switch" role="group" aria-label="板块类型">{([['industry', '行业板块'], ['concept', '概念板块']] as const).map(([value, label]) => <button key={value} aria-pressed={grouping === value} className={grouping === value ? 'active' : ''} onClick={() => { setGrouping(value); setSelected(''); setPage(1); }}>{label}</button>)}</div>
        <div className="mm-switch" role="group" aria-label="股票筛选">{([['limit', '涨停股票'], ['gainers', '涨幅 ≥5%']] as const).map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setPage(1); }}>{label}</button>)}</div>
        <input className="mm-search" aria-label="搜索股票或板块" placeholder="搜索股票名称、代码或板块" value={search} onChange={e => { setSearch(e.target.value); setSelected(''); setPage(1); }} />
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">涨幅 ≥5% 包含其中的涨停股。{grouping === 'concept' ? '同一股票可归属多个概念，板块数量不可直接相加。' : '每只股票按行情源所属行业归组。'}</p>
    </section>
    {!snapshot ? <div className="mm-card p-12 text-center text-gray-500 dark:text-gray-400" role="status">{error || data?.error ? '暂未取得有效行情，将自动重试。' : '正在获取全市场行情，首次加载可能需要较长时间…'}</div> : <div className="mm-workspace">
      <label className="mm-mobile-group mm-card p-3">
        <span className="mb-2 block text-sm font-medium">{grouping === 'industry' ? '行业板块' : '概念板块'}</span>
        <select aria-label="选择板块" value={selected} onChange={e => { setSelected(e.target.value); setPage(1); }}>
          <option value="">全部股票（{matching.length}）</option>
          {selected && !groups.some(g => g.name === selected) && <option value={selected}>{selected}（0）</option>}
          {groups.map(g => <option key={g.name} value={g.name}>{g.name}（{g.stocks.length} 只 / 涨停 {g.limits} 只）</option>)}
        </select>
      </label>
      <aside className="mm-desktop mm-card overflow-hidden" aria-label="板块列表">
        <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold dark:border-gray-700">{grouping === 'industry' ? '行业' : '概念'}分组 <span className="text-gray-400">{groups.length}</span></div>
        <div className="mm-groups">
          <button className={`mm-group ${selected === '' ? 'active' : ''}`} onClick={() => { setSelected(''); setPage(1); }}><span>全部股票</span><strong>{matching.length}</strong></button>
          {groups.map(group => <button key={group.name} className={`mm-group ${selected === group.name ? 'active' : ''}`} aria-pressed={selected === group.name} onClick={() => { setSelected(group.name); setPage(1); }}><span>{group.name}<small>{group.limits} 只涨停</small></span><strong>{group.stocks.length}</strong></button>)}
        </div>
      </aside>
      <section className="mm-card min-w-0 overflow-hidden">
        <div className="flex justify-between border-b border-gray-200 p-4 dark:border-gray-700"><h2 className="font-semibold">{selected || '全部股票'}</h2><span className="text-sm text-gray-500 dark:text-gray-400">{visible.length} 只股票</span></div>
        <div className="mm-desktop overflow-x-auto" tabIndex={0} role="region" aria-label="强势股明细">
          <table className="mm-table"><thead><tr><th>股票</th><th>最新价</th><th>当日涨幅</th><th>状态</th><th>成交额</th><th>所属行业</th></tr></thead><tbody>
            {displayed.map(stock => <tr key={stock.code}><td><Link className="font-medium text-blue-600 hover:underline dark:text-blue-400" to={`/stock/${stock.code}`}>{stock.name}</Link><small>{stock.code}</small></td><td>{stock.price.toFixed(2)}</td><td className="font-semibold text-red-600 dark:text-red-400">+{stock.change_percent.toFixed(2)}%</td><td>{stock.limit_up ? <span className="mm-limit">涨停</span> : stock.limit_known ? <span className="mm-gainer">≥5%</span> : <span className="text-xs text-amber-600 dark:text-amber-400">涨停待确认</span>}</td><td>{money(stock.amount)}</td><td>{stock.industry}</td></tr>)}
          </tbody></table>
        </div>
        <ul className="mm-mobile-stocks" aria-label="强势股明细">
          {displayed.map(stock => <li key={stock.code} className="border-b border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3">
              <Link className="mm-stock-link min-w-0 font-medium text-blue-600 dark:text-blue-400" to={`/stock/${stock.code}`}>{stock.name}<span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">{stock.code}</span></Link>
              <div className="shrink-0 text-right"><div className="text-lg font-semibold text-red-600 dark:text-red-400">+{stock.change_percent.toFixed(2)}%</div>
                {stock.limit_up ? <span className="mm-limit">涨停</span> : stock.limit_known ? <span className="mm-gainer">≥5%</span> : <span className="text-xs text-amber-600 dark:text-amber-400">涨停待确认</span>}
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">最新价</dt><dd className="mt-1">{stock.price.toFixed(2)}</dd></div>
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">成交额</dt><dd className="mt-1">{money(stock.amount)}</dd></div>
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">所属行业</dt><dd className="mt-1 break-words">{stock.industry}</dd></div>
            </dl>
          </li>)}
        </ul>
        {!visible.length && <p className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">当前条件下没有符合的股票，可切换筛选或清空搜索。</p>}
        <div className="mm-pagination flex items-center justify-between gap-2 border-t border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"><span>第 {currentPage} / {maxPage} 页 · 每页 40 只</span><div className="flex gap-2"><button className="mm-secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>上一页</button><button className="mm-secondary" disabled={currentPage >= maxPage} onClick={() => setPage(currentPage + 1)}>下一页</button></div></div>
      </section>
    </div>}
    <footer className="text-xs leading-6 text-gray-500 dark:text-gray-400">数据源：东方财富 · 覆盖沪深主板、创业板、科创板，不含 B 股和北交所。涨停按行情源实际涨停价判定，非盘中触板统计。{snapshot && ` ${snapshot.invalid_count} 只无有效报价股票未参与筛选。`}</footer>
  </div>;
}
