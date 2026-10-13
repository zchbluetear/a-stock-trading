import threading
import unittest
from datetime import datetime
from unittest.mock import patch

from flask import Flask
import market_movers as mm

STAMP = int(datetime(2026, 10, 13, 10, 0, tzinfo=mm.TZ).timestamp())


def row(code='600001', name='示例', pct=5, price=10.5, industry='银行', concepts='金融科技,融资融券,金融科技'):
    return dict(f12=code, f13=1 if code.startswith('6') else 0, f14=name, f3=pct,
                f2=price, f100=industry, f103=concepts, f124=STAMP, f6=10000000)


class MoversChecks(unittest.TestCase):
    def test_threshold_and_limit_union_st_rounding(self):
        rows = [row(), row('600002', pct=4.99), row('000001', '*ST 示例', 4.94, 2.55),
                row('300001', pct=20, price=12), row('688001', pct=19.99, price=11.99)]
        result = mm.build_snapshot(rows, {'600001': 11, '000001': 2.55, '300001': 12, '688001': 12})
        self.assertEqual({s['code'] for s in result['stocks']}, {'600001', '000001', '300001', '688001'})
        self.assertEqual(result['gainer_count'], 3)
        self.assertEqual(result['limit_up_count'], 2)
        self.assertEqual(len(result['stocks']), 4)
        self.assertEqual(result['stocks'][0]['code'], '300001')

    def test_unknown_limit_and_unclassified_are_not_fabricated(self):
        rows = [row(industry='-', concepts='-'), row('600002', pct='-'),
                row('600003', price=float('nan')), row('600004', price=0)]
        result = mm.build_snapshot(rows, {})
        self.assertEqual(result['invalid_count'], 3)
        self.assertEqual(result['limit_unknown_count'], 1)
        self.assertEqual(result['limit_up_count'], 0)
        self.assertEqual(result['stocks'][0]['industry'], '未分类行业')
        self.assertEqual(result['stocks'][0]['concepts'], ['未分类概念'])
        self.assertFalse(result['stocks'][0]['limit_known'])

    def test_concepts_deduplicate(self):
        result = mm.build_snapshot([row()], {'600001': 11})
        self.assertEqual(set(result['stocks'][0]['concepts']), {'金融科技', '融资融券'})

    def test_full_pagination_and_duplicate_rejection(self):
        rows = [row(str(600000 + n)) for n in range(101)]
        with patch.object(mm, 'fetch_page', side_effect=lambda page: {'total': 101, 'diff': rows[:100] if page == 1 else rows[100:]}):
            self.assertEqual(len(mm.fetch_market()), 101)
        with patch.object(mm, 'fetch_page', side_effect=lambda page: {'total': 101, 'diff': rows[:100] if page == 1 else rows[:1]}):
            with self.assertRaises(ValueError): mm.fetch_market()
        with patch.object(mm, 'fetch_page', return_value={'total': 101, 'diff': []}):
            with self.assertRaises(ValueError): mm.fetch_market()

    def test_limit_cache_is_quote_date_specific(self):
        prices = mm.LimitPrices()
        with patch.object(mm, 'get_json', return_value={'f57': '600001', 'f51': 11, 'f86': STAMP}) as fetch:
            self.assertEqual(prices.resolve([row()]), {'600001': 11})
            prices.resolve([row()])
            self.assertEqual(fetch.call_count, 1)
            next_day = row(); next_day['f124'] += 86400
            self.assertIsNone(prices.resolve([next_day])['600001'])
            self.assertEqual(fetch.call_count, 2)

    def test_failure_keeps_previous_snapshot_and_no_overlapping_worker(self):
        scanner = mm.MarketScanner()
        scanner.snapshot = {'fetched_at': datetime.now(mm.TZ).isoformat(), 'stocks': []}
        prior = scanner.snapshot
        entered = threading.Event()
        release = threading.Event()
        def fail():
            entered.set(); release.wait(3)
            raise ValueError('upstream failure')
        def expire(_):
            with scanner.lock: scanner.last_access = -100
        with patch.object(scanner, 'scan', side_effect=fail) as scan, patch.object(mm.time, 'sleep', side_effect=expire):
            scanner.read()
            self.assertTrue(entered.wait(2))
            worker = scanner.worker
            for _ in range(10): scanner.read()
            self.assertEqual(scan.call_count, 1)
            release.set(); worker.join(3)
        self.assertIs(scanner.snapshot, prior)
        self.assertIsNotNone(scanner.error)
        self.assertIsNone(scanner.worker)

    def test_endpoint_and_stale_state(self):
        app = Flask(__name__)
        mm.register_market_mover_routes(app)
        with patch.object(mm.scanner, 'read', return_value={'snapshot': None, 'refreshing': True}):
            response = app.test_client().get('/api/market/movers')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
            self.assertIsNone(response.json['snapshot'])
        scanner = mm.MarketScanner()
        scanner.snapshot = {'fetched_at': '2020-01-01T00:00:00+08:00'}
        with patch.object(mm.threading.Thread, 'start'):
            self.assertTrue(scanner.read()['stale'])


if __name__ == '__main__':
    unittest.main()
