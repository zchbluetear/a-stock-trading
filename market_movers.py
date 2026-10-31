"""Shared, non-overlapping whole-market scans for the sector movers page."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from decimal import Decimal
import math
import os
import threading
import time
from zoneinfo import ZoneInfo

import requests
from flask import jsonify

TZ = ZoneInfo('Asia/Shanghai')
INTERVAL = 60
IDLE_TIMEOUT = INTERVAL + 15
PAGE_SIZE = 100
WORKERS = 8


def number(value):
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def quote_date(timestamp):
    value = number(timestamp)
    return datetime.fromtimestamp(value, TZ).date().isoformat() if value and value > 0 else None


def get_json(url, params):
    proxy = os.environ.get('MARKET_HTTP_PROXY')
    response = requests.get(url, params=params, timeout=(3, 8),
                            proxies={'https': proxy, 'http': proxy} if proxy else None,
                            headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'})
    response.raise_for_status()
    payload = response.json()
    if payload.get('rc') != 0 or not isinstance(payload.get('data'), dict):
        raise ValueError('行情源响应无效')
    return payload['data']


def fetch_page(page):
    return get_json('https://push2.eastmoney.com/api/qt/clist/get', {
        'pn': page, 'pz': PAGE_SIZE, 'po': 1, 'np': 1, 'fltt': 2, 'invt': 2,
        # Stable code order; exclude Beijing and B shares.
        'fid': 'f12', 'fs': 'm:0 t:6,m:0 t:80,m:1 t:2,m:1 t:23',
        'fields': 'f2,f3,f6,f12,f13,f14,f100,f103,f124',
    })


def fetch_market():
    first = fetch_page(1)
    total = first.get('total')
    if not isinstance(total, int) or total <= 0 or total > 20000:
        raise ValueError('行情源股票总数无效')
    pages = math.ceil(total / PAGE_SIZE)
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        responses = [first] + list(pool.map(fetch_page, range(2, pages + 1)))
    rows = []
    for page in responses:
        if page.get('total') != total or not isinstance(page.get('diff'), list):
            raise ValueError('行情分页发生变化，等待下一轮完整扫描')
        rows.extend(page['diff'])
    if len(rows) != total or len({r.get('f12') for r in rows}) != total:
        raise ValueError('行情分页缺失或重复，保留上次完整快照')
    return rows


class LimitPrices:
    """The exchange-supplied upper price is stable within a quote date."""
    def __init__(self):
        self.cache = {}

    def fetch(self, row):
        day = quote_date(row.get('f124'))
        key = (day, row['f12'])
        if key in self.cache:
            return row['f12'], self.cache[key]
        try:
            data = get_json('https://push2.eastmoney.com/api/qt/stock/get', {
                'secid': f"{row['f13']}.{row['f12']}", 'fltt': 2,
                'fields': 'f51,f57,f86',
            })
            if data.get('f57') != row['f12'] or quote_date(data.get('f86')) != day:
                raise ValueError('涨停价日期不匹配')
            upper = number(data.get('f51'))
            # Missing upper price (e.g. unrestricted new listings) is unknown,
            # never a guessed 5/10/20 percent limit.
            if upper is not None and upper > 0:
                self.cache[key] = upper
                return row['f12'], upper
        except (requests.RequestException, ValueError, KeyError):
            pass
        return row['f12'], None

    def resolve(self, rows):
        days = {quote_date(r.get('f124')) for r in rows}
        self.cache = {k: v for k, v in self.cache.items() if k[0] in days}
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            return dict(pool.map(self.fetch, rows))


def is_candidate(row):
    change = number(row.get('f3'))
    # ST can be limit-up below the displayed 5% after price rounding.
    return change is not None and (change >= 5 or (change > 0 and 'ST' in row.get('f14', '').upper()))


def build_snapshot(rows, limits):
    stocks = []
    unknown = invalid = 0
    up_count = down_count = flat_count = 0
    dates = set()
    timestamps = []
    for row in rows:
        price, change = number(row.get('f2')), number(row.get('f3'))
        day = quote_date(row.get('f124'))
        if day:
            dates.add(day)
            timestamps.append(float(row['f124']))
        if price is None or price <= 0 or change is None or not day:
            invalid += 1
            continue
        # 统计涨跌平家数（在 is_candidate 过滤之前）
        if change > 0:
            up_count += 1
        elif change < 0:
            down_count += 1
        else:
            flat_count += 1
        if not is_candidate(row):
            continue
        upper = limits.get(row['f12'])
        if upper is None:
            unknown += 1
        limit_up = upper is not None and Decimal(str(price)) == Decimal(str(upper))
        if change < 5 and not limit_up:
            continue
        industry = row.get('f100')
        industry = industry.strip() if isinstance(industry, str) and industry.strip() not in ('', '-') else '未分类行业'
        raw_concepts = row.get('f103')
        concepts = sorted({v.strip() for v in raw_concepts.split(',') if v.strip() and v.strip() != '-'}) if isinstance(raw_concepts, str) else []
        stocks.append({'code': row['f12'], 'name': row['f14'], 'price': price,
                       'change_percent': change, 'amount': number(row.get('f6')),
                       'industry': industry, 'concepts': concepts or ['未分类概念'],
                       'limit_up': limit_up, 'limit_known': upper is not None,
                       'quote_time': datetime.fromtimestamp(float(row['f124']), TZ).isoformat()})
    if not timestamps:
        raise ValueError('行情源未返回有效行情时间')
    stocks.sort(key=lambda r: (-r['change_percent'], r['code']))
    return {'stocks': stocks, 'total': len(rows), 'invalid_count': invalid,
            'limit_unknown_count': unknown, 'quote_dates': sorted(dates),
            'quote_time': datetime.fromtimestamp(max(timestamps), TZ).isoformat(),
            'limit_up_count': sum(s['limit_up'] for s in stocks),
            'gainer_count': sum(s['change_percent'] >= 5 for s in stocks),
            'up_count': up_count, 'down_count': down_count, 'flat_count': flat_count}


class MarketScanner:
    def __init__(self):
        self.lock = threading.Lock()
        self.worker = None
        self.last_access = 0
        self.snapshot = None
        self.error = None
        self.refreshing = False
        self.last_attempt = None
        self.duration = None
        self.limits = LimitPrices()

    def scan(self):
        rows = fetch_market()
        limits = self.limits.resolve([r for r in rows if is_candidate(r)])
        result = build_snapshot(rows, limits)
        result['fetched_at'] = datetime.now(TZ).isoformat()
        return result

    def run(self):
        while True:
            started = time.monotonic()
            with self.lock:
                # Stop upstream traffic after all viewers pause/leave.
                if started - self.last_access > IDLE_TIMEOUT:
                    self.worker = None
                    return
                self.refreshing = True
                self.last_attempt = datetime.now(TZ).isoformat()
            try:
                snapshot = self.scan()
                with self.lock:
                    self.snapshot = snapshot
                    self.error = None
            except Exception:
                with self.lock:
                    self.error = '行情源请求失败或全市场数据不完整，等待下一轮重试。'
            finally:
                with self.lock:
                    self.refreshing = False
                    self.duration = round(time.monotonic() - started, 2)
            # Never overlap scans, even if the upstream takes longer than 5s.
            time.sleep(max(0, INTERVAL - (time.monotonic() - started)))

    def read(self):
        with self.lock:
            self.last_access = time.monotonic()
            if self.worker is None:
                self.worker = threading.Thread(target=self.run, daemon=True, name='market-movers')
                self.worker.start()
            snapshot = self.snapshot
            stale = not snapshot or (datetime.now(TZ) - datetime.fromisoformat(snapshot['fetched_at'])).total_seconds() > INTERVAL * 1.5
            return {'snapshot': snapshot, 'refreshing': self.refreshing or snapshot is None,
                    'error': self.error, 'stale': stale, 'interval_seconds': INTERVAL,
                    'last_attempt': self.last_attempt, 'scan_seconds': self.duration}


scanner = MarketScanner()


def register_market_mover_routes(app):
    @app.get('/api/market/movers')
    def market_movers():
        response = jsonify(scanner.read())
        response.headers['Cache-Control'] = 'no-store'
        return response
