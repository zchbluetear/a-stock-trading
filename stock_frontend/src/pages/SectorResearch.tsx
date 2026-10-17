import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSectorResearch } from '../services/sectorResearch';
import type { SectorRow, SectorSource } from '../services/sectorResearch';
import './SectorResearch.css';

type Filter = 'today' | 'persistent' | 'all';
type Sort = 'rank' | 'appearances' | 'change';
const filters: { value: Filter; label: string }[] = [
  { value: 'today', label: '当日上榜' }, { value: 'persistent', label: '持续活跃' },
];
function RankChange({ row }: { row: SectorRow }) {
  if (row.is_new) return <span className="sr-tag sr-tag-new">新进</span>;
  if (row.rank_change === null) return <span className="sr-muted">—</span>;
  if (row.rank_change === 0) return <span className="sr-muted">持平</span>;
  return <span className={row.rank_change > 0 ? 'sr-up' : 'sr-down'}>{row.rank_change > 0 ? '↑' : '↓'} {Math.abs(row.rank_change)} 位</span>;
}
function MiniHistory({ row }: { row: SectorRow }) {
  return <div className="sr-mini" aria-label={`${row.name}排名轨迹，左旧右新`}>
    {row.history.map(p => <span key={p.date} title={`${p.date}：${p.rank ? `第 ${p.rank} 名` : p.complete ? '未上榜' : '数据不全'}`}
      className={!p.complete ? 'sr-mini-unknown' : p.rank ? 'sr-mini-ranked' : 'sr-mini-empty'}
      style={{ height: p.rank ? `${8 + (11 - p.rank) * 2}px` : '4px', opacity: p.rank ? 0.35 + (11 - p.rank) * 0.065 : 1 }} />)}
  </div>;
}
export default function SectorResearch() {
  const [source, setSource] = useState<SectorSource>('kaipan');
  const [window, setWindow] = useState(5);
  const [date, setDate] = useState('');
  const [filter, setFilter] = useState<Filter>('today');
  const [sort, setSort] = useState<Sort>('rank');
  const [search, setSearch] = useState('');
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['sector-research', source, window, date],
    queryFn: ({ signal }) => getSectorResearch(source, window, date, signal),
    staleTime: 180000, refetchInterval: 300000, retry: 1,
  });
  const rows = useMemo(() => {
    const result = (data?.rows || []).filter(r => {
      if (search && !`${r.name}${r.code}`.toLowerCase().includes(search.toLowerCase().trim())) return false;
      if (filter === 'today') return r.rank !== null;
      if (filter === 'persistent') return r.streak >= 3;
      return true;
    });
    return result.sort((a, b) => sort === 'appearances' ? b.appearances - a.appearances || (a.rank ?? 99) - (b.rank ?? 99)
      : sort === 'change' ? (b.rank_change ?? -99) - (a.rank_change ?? -99) || (a.rank ?? 99) - (b.rank ?? 99)
      : (a.rank ?? 99) - (b.rank ?? 99) || b.appearances - a.appearances);
  }, [data, search, filter, sort]);
  const heatRows = [...(data?.rows || [])].sort((a, b) => b.appearances - a.appearances || (a.best_rank ?? 99) - (b.best_rank ?? 99)).slice(0, 12);
  const activeDateIndex = data?.dates.indexOf(data.date) ?? -1;
  const switchSource = (next: SectorSource) => { setSource(next); setDate(''); };
  return <div className="sector-research">
    <section className="sr-toolbar" aria-label="研究条件">
      <div className="sr-source" role="group" aria-label="数据来源">
        <button aria-pressed={source === 'kaipan'} className={source === 'kaipan' ? 'active' : ''} onClick={() => switchSource('kaipan')}>开盘啦 <small>强度</small></button>
        <button aria-pressed={source === 'ths'} className={source === 'ths' ? 'active' : ''} onClick={() => switchSource('ths')}>同花顺 <small>涨幅</small></button>
      </div>
      <div className="sr-controls">
        <label>时间范围<select value={window} onChange={e => setWindow(Number(e.target.value))}>{[5, 10, 20].map(n => <option key={n} value={n}>近 {n} 天</option>)}</select></label>
        <div className="sr-date-control"><button aria-label="上一快照" disabled={!data || activeDateIndex >= data.dates.length - 1} onClick={() => data && setDate(data.dates[activeDateIndex + 1])}>‹</button>
          <label className="sr-date-label"><span className="sr-sr-only">复盘日期</span><select value={data?.date || ''} disabled={!data} onChange={e => setDate(e.target.value)}>{data ? data.dates.map(d => <option key={d} value={d}>{d}</option>) : <option value="">加载日期…</option>}</select></label>
          <button aria-label="下一快照" disabled={!data || activeDateIndex <= 0} onClick={() => data && setDate(data.dates[activeDateIndex - 1])}>›</button></div>
        <button className="sr-latest" onClick={() => setDate('')} disabled={!date}>最新</button>
      </div>
    </section>

    {error && <div className="sr-notice sr-error" role="alert"><strong>数据更新失败</strong><span>{error.message}{data ? '；下方保留上次成功结果，请注意抓取时间。' : ''}</span><button onClick={() => refetch()}>重试 ↻</button></div>}
    {isPending && <div className="sr-loading" role="status"><span className="sr-spin">◌</span> 正在读取板块排名与历史快照…</div>}
    {data && <>
      <div className="sr-meta"><span>抓取于 {new Date(data.fetched_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）</span></div>
      {(!data.complete || data.complete_count < data.sample_count) && <div className="sr-notice" role="status">
        <span>ⓘ</span><span>部分快照不完整，持续性只统计完整快照。</span>
      </div>}

      <div className="sr-workspace">
        <section className="sr-panel sr-ranking">
          <div className="sr-section-title"><div><h2>板块趋势</h2></div></div>
          <div className="sr-tabs" role="group" aria-label="榜单筛选">{filters.map(f => <button key={f.value} aria-pressed={filter === f.value} className={filter === f.value ? 'active' : ''} onClick={() => setFilter(f.value)}>{f.label}</button>)}</div>
          <div className="sr-table-tools"><label className="sr-search"><span>⌕</span><input aria-label="搜索板块" placeholder="搜索板块名称或代码" value={search} onChange={e => setSearch(e.target.value)} /></label>
            <label><span className="sr-sr-only">排序方式</span><select value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="rank">按当日排名</option><option value="appearances">按上榜次数</option><option value="change">按排名提升</option></select></label></div>
          <p className="sr-scroll-hint">左右滑动表格，查看完整排名和近期轨迹</p>
          <div className="sr-table-scroll" tabIndex={0} role="region" aria-label="板块排名表"><table className="sr-table"><thead><tr><th>排名 / 板块</th><th>排名变化</th><th>上榜次数</th><th>近期轨迹</th></tr></thead><tbody>
            {rows.map(r => <tr key={r.code}>
              <td><div className="sr-row-select"><span className={`sr-rank ${r.rank && r.rank <= 3 ? 'sr-rank-top' : ''}`}>{r.rank ?? '—'}</span><span className="sr-sector-name"><strong>{r.name}</strong><small>{r.code}{r.streak >= 3 ? ` · 连续 ${r.streak} 次` : ''}</small></span></div></td>
              <td><RankChange row={r} /></td><td><strong>{r.appearances}</strong><span className="sr-muted"> / {data.complete_count}</span></td><td><MiniHistory row={r} /></td>
            </tr>)}
          </tbody></table></div>
        </section>

      </div>

      <section className="sr-panel sr-rotation"><div className="sr-section-title"><div><h2>板块轮动</h2></div><div className="sr-legend"><span>排名</span><i className="sr-heat-strong" />1–3<i className="sr-heat-mid" />4–6<i className="sr-heat-light" />7–10<span>— 未上榜</span></div></div>
        <div className="sr-heat-scroll" tabIndex={0} role="region" aria-label="板块轮动矩阵"><table className="sr-heat-table"><thead><tr><th>板块 / 上榜次数</th>{heatRows[0]?.history.map(p => <th key={p.date}><button title={`复盘 ${p.date}`} onClick={() => setDate(p.date)}>{p.date.slice(5)}</button></th>)}</tr></thead><tbody>{heatRows.map(r => <tr key={r.code}><th><button onClick={() => { setFilter('all'); setSearch(r.code); }} title="在上方榜单筛选此板块">{r.name}<span>{r.appearances} 次</span></button></th>{r.history.map(p => <td key={p.date}><span title={`${r.name} · ${p.date} · ${p.rank ? `第${p.rank}名` : p.complete ? '未上榜' : '数据不全'}`} className={!p.complete ? 'sr-heat-unknown' : p.rank === null ? 'sr-heat-empty' : p.rank <= 3 ? 'sr-heat-strong' : p.rank <= 6 ? 'sr-heat-mid' : 'sr-heat-light'}>{p.rank ?? (p.complete ? '—' : '?')}</span></td>)}</tr>)}</tbody></table></div>
      </section>
    </>}
  </div>;
}
