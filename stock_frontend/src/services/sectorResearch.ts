import { stockAPI } from './api';

export type SectorSource = 'kaipan' | 'ths';
export interface SectorPoint { date: string; rank: number | null; value: number | null; complete: boolean }
export interface SectorRow {
  code: string; name: string; rank: number | null; value: number | null;
  rank_change: number | null; is_new: boolean; appearances: number;
  streak: number; best_rank: number | null; history: SectorPoint[];
}
export interface SectorResearchData {
  success: boolean; source: SectorSource; source_name: string; value_type: 'score' | 'pct';
  date: string; latest_date: string; dates: string[]; window: number; sample_count: number;
  complete_count: number; previous_date: string | null; complete: boolean; comparison_available: boolean;
  fetched_at: string; latest_is_today: boolean; rows: SectorRow[];
}
export async function getSectorResearch(source: SectorSource, window: number, date: string, signal?: AbortSignal): Promise<SectorResearchData> {
  const params = new URLSearchParams({ source, window: String(window) });
  if (date) params.set('date', date);
  const response = await fetch(`${stockAPI.getBaseURL()}/api/market/sectors/research?${params}`, { signal });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error(body?.error || '板块数据加载失败，请检查服务连接');
  return body;
}
