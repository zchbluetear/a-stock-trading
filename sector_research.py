"""Daily sector research: validated upstream snapshots, never synthetic quotes."""
from copy import deepcopy
from datetime import date, datetime
from html.parser import HTMLParser
import math
import re
import threading
import time
from zoneinfo import ZoneInfo

import requests
from flask import jsonify, request

TZ = ZoneInfo('Asia/Shanghai')
SOURCES = {'kaipan': ('开盘啦', 'score'), 'ths': ('同花顺', 'pct')}
_cache = {}
_lock = threading.Lock()


class _Table(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = []
        elif tag == 'td' and self.row is not None:
            self.cell = {'attrs': dict(attrs), 'text': []}
            self.row.append(self.cell)

    def handle_data(self, data):
        if self.cell is not None:
            self.cell['text'].append(data.strip())

    def handle_endtag(self, tag):
        if tag == 'td':
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = self.cell = None


def parse_snapshots(payload, source):
    if source not in SOURCES or not isinstance(payload, dict):
        raise ValueError('板块来源或响应格式无效')
    table = _Table()
    table.feed(payload.get('html', ''))
    if not table.rows:
        raise ValueError('上游未返回板块榜单')
    dates = [''.join(c['text']) for c in table.rows[0][1:]]
    if not dates or len(set(dates)) != len(dates):
        raise ValueError('上游日期缺失或重复')
    for d in dates:
        date.fromisoformat(d)
    if dates != sorted(dates, reverse=True):
        raise ValueError('上游日期顺序异常')
    snapshots = {d: {'date': d, 'rows': [], 'complete': True} for d in dates}
    rank_rows = [r for r in table.rows[1:] if r and ''.join(r[0]['text']).isdigit()]
    if [int(''.join(r[0]['text'])) for r in rank_rows] != list(range(1, 11)):
        raise ValueError('上游 Top10 排名结构不完整')
    for row in rank_rows:
        rank = int(''.join(row[0]['text']))
        # Never compress empty cells: column positions carry the snapshot dates.
        for i, d in enumerate(dates):
            cell = row[i + 1] if i + 1 < len(row) else {'attrs': {}, 'text': []}
            attrs = cell['attrs']
            code, name = attrs.get('code', ''), attrs.get('name', '').strip()
            value_text = ' '.join(cell['text']).strip()
            match = re.search(r'(?:^|\s)([+-]?\d+(?:\.\d+)?%?)$', value_text)
            prefix = '88' if source == 'ths' else '80'
            if (not re.fullmatch(r'\d{6}', code) or not code.startswith(prefix)
                    or not name or not match):
                snapshots[d]['complete'] = False
                continue
            raw = match.group(1)
            value = float(raw.rstrip('%'))
            if raw.endswith('%') != (source == 'ths') or not math.isfinite(value):
                snapshots[d]['complete'] = False
                continue
            snapshots[d]['rows'].append({'rank': rank, 'code': code, 'name': name, 'value': value})
    for snapshot in snapshots.values():
        rows = snapshot['rows']
        if len(rows) != 10 or len({r['code'] for r in rows}) != 10:
            snapshot['complete'] = False
    if not any(s['rows'] for s in snapshots.values()):
        raise ValueError('上游榜单无有效板块数据')
    return list(snapshots.values())


def fetch_snapshots(source):
    # One bounded cache per source; fetch time is distinct from market date.
    with _lock:
        cached = _cache.get(source)
        if cached and time.monotonic() - cached[0] < 180:
            return deepcopy(cached[1])
    response = requests.post('https://duanxianxia.com/api/getPlateRotatData',
        data={'from': source, 'days': 50}, timeout=(5, 20), headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://duanxianxia.com/web/main',
            'Origin': 'https://duanxianxia.com', 'X-Requested-With': 'XMLHttpRequest'})
    response.raise_for_status()
    result = {'snapshots': parse_snapshots(response.json(), source),
              'fetched_at': datetime.now(TZ).isoformat()}
    with _lock:
        _cache[source] = (time.monotonic(), result)
    return deepcopy(result)


def build_research(data, source, selected_date=None, window=10):
    snapshots = data['snapshots']
    dates = [s['date'] for s in snapshots]
    selected_date = selected_date or dates[0]
    if selected_date not in dates:
        raise ValueError('所选日期没有可用快照')
    start = dates.index(selected_date)
    history = snapshots[start:start + window]
    current = history[0]
    previous = snapshots[start + 1] if start + 1 < len(snapshots) else None
    valid = [s for s in history if s['complete']]
    by_date = {s['date']: {r['code']: r for r in s['rows']} for s in history}
    universe = {r['code']: r for s in reversed(history) for r in s['rows']}
    previous_rows = {r['code']: r for r in previous['rows']} if previous else {}
    rows = []
    for code, base in universe.items():
        today = by_date[selected_date].get(code)
        prev = previous_rows.get(code)
        comparable = current['complete'] and previous is not None and previous['complete']
        streak = 0
        for s in history:
            if not s['complete'] or code not in by_date[s['date']]:
                break
            streak += 1
        appearances = sum(code in by_date[s['date']] for s in valid)
        ranks = [by_date[s['date']][code]['rank'] for s in valid if code in by_date[s['date']]]
        rows.append({'code': code, 'name': base['name'],
            'rank': today['rank'] if today else None,
            'value': today['value'] if today else None,
            'rank_change': prev['rank'] - today['rank'] if comparable and prev and today else None,
            'is_new': bool(comparable and today and not prev),
            'appearances': appearances, 'streak': streak,
            'best_rank': min(ranks) if ranks else None,
            'history': [{'date': s['date'],
                         'rank': by_date[s['date']].get(code, {}).get('rank'),
                         'value': by_date[s['date']].get(code, {}).get('value'),
                         'complete': s['complete']} for s in reversed(history)]})
    rows.sort(key=lambda r: (r['rank'] is None, r['rank'] or 99, -r['appearances'], r['code']))
    return {'success': True, 'source': source, 'source_name': SOURCES[source][0],
        'value_type': SOURCES[source][1], 'date': selected_date,
        'latest_date': dates[0], 'dates': dates, 'window': window,
        'sample_count': len(history), 'complete_count': len(valid),
        'previous_date': previous['date'] if previous else None,
        'complete': current['complete'],
        'comparison_available': bool(current['complete'] and previous and previous['complete']),
        'fetched_at': data['fetched_at'],
        'latest_is_today': dates[0] == datetime.now(TZ).date().isoformat(),
        'rows': rows}


def register_sector_routes(app):
    @app.get('/api/market/sectors/research')
    def sector_research():
        source = request.args.get('source', 'kaipan')
        try:
            window = int(request.args.get('window', 10))
        except ValueError:
            return jsonify(success=False, error='观察窗口必须为 5、10 或 20'), 400
        if source not in SOURCES or window not in (5, 10, 20):
            return jsonify(success=False, error='板块来源或观察窗口无效'), 400
        selected = request.args.get('date') or None
        if selected:
            try:
                date.fromisoformat(selected)
            except ValueError:
                return jsonify(success=False, error='日期格式应为 YYYY-MM-DD'), 400
        try:
            data = fetch_snapshots(source)
        except (requests.RequestException, ValueError, TypeError) as exc:
            app.logger.warning('Sector research upstream unavailable: %s', type(exc).__name__)
            return jsonify(success=False, error='板块数据源暂不可用，请稍后重试。未使用模拟行情。'), 502
        try:
            return jsonify(build_research(data, source, selected, window))
        except ValueError as exc:
            return jsonify(success=False, error=str(exc)), 400
