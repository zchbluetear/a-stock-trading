"""Run: python3 -m unittest discover -s checks -p check_sector_research.py"""
import unittest
from unittest.mock import patch
from flask import Flask
import requests
from sector_research import parse_snapshots, build_research, register_sector_routes


def payload(source='kaipan', empty=None):
    dates = ['2026-10-09', '2026-10-08', '2026-09-30', '2026-09-29']
    html = '<tr><td>排名</td>' + ''.join(f'<td>{d}</td>' for d in dates) + '</tr>'
    for rank in range(1, 11):
        html += f'<tr><td><span class="rank">{rank}</span></td>'
        for i in range(len(dates)):
            # A new leader today replaces historical rank 1.
            suffix = 99 if i == 0 and rank == 1 else rank
            code = ('88' if source == 'ths' else '80') + f'{suffix:04d}'
            val = f'{rank}.25%' if source == 'ths' else str(2000 - rank * 100)
            if empty == (rank, i):
                html += '<td></td>'
            else:
                html += f'<td class="plate" code="{code}" name="板块{suffix}"><span>板块{suffix}</span><br><span>{val}</span></td>'
        html += '</tr>'
    return {'html': html}


def data(source='kaipan', empty=None):
    return {'snapshots': parse_snapshots(payload(source, empty), source), 'fetched_at': '2026-10-12T10:00:00+08:00'}


class SectorResearchChecks(unittest.TestCase):
    def test_two_sources_have_separate_units(self):
        self.assertEqual(data()['snapshots'][0]['rows'][0]['value'], 1900)
        self.assertEqual(data('ths')['snapshots'][0]['rows'][0]['value'], 1.25)
        with self.assertRaises(ValueError):
            parse_snapshots(payload('ths'), 'kaipan')

    def test_empty_cell_does_not_shift_dates(self):
        result = data(empty=(2, 0))['snapshots']
        self.assertFalse(result[0]['complete'])
        self.assertNotIn('800002', [r['code'] for r in result[0]['rows']])
        self.assertEqual(result[1]['rows'][1]['code'], '800002')
        self.assertTrue(result[1]['complete'])

    def test_history_excludes_future_and_new_entry_is_not_fake_rank(self):
        current = build_research(data(), 'kaipan', window=5)
        self.assertTrue(current['rows'][0]['is_new'])
        self.assertIsNone(current['rows'][0]['rank_change'])
        past = build_research(data(), 'kaipan', '2026-10-08', 5)
        self.assertNotIn('800099', [r['code'] for r in past['rows']])
        self.assertEqual(past['rows'][0]['streak'], 3)
        self.assertEqual(past['sample_count'], 3)
        self.assertEqual(past['rows'][0]['history'][-1]['date'], '2026-10-08')

    def test_incomplete_snapshot_is_not_absence_or_new_entry(self):
        result = build_research(data(empty=(1, 1)), 'kaipan', window=5)
        self.assertEqual(result['complete_count'], 3)
        self.assertFalse(result['rows'][0]['is_new'])
        self.assertEqual(result['rows'][1]['streak'], 1)
        self.assertIsNone(result['rows'][1]['rank_change'])

    def test_duplicates_mark_snapshot_incomplete(self):
        p = payload(); p['html'] = p['html'].replace('code="800099"', 'code="800002"')
        self.assertFalse(parse_snapshots(p, 'kaipan')[0]['complete'])

    def test_invalid_payload_and_date_rejected(self):
        for p in ({}, {'html': '<tr><td>排名</td><td>bad-date</td></tr>'}):
            with self.assertRaises(ValueError): parse_snapshots(p, 'kaipan')
        with self.assertRaises(ValueError): build_research(data(), 'kaipan', '2020-01-01')

    def test_rank_change_and_absence(self):
        d = data()
        d['snapshots'][0]['rows'][1]['rank'] = 4
        result = build_research(d, 'kaipan')
        row = next(r for r in result['rows'] if r['code'] == '800002')
        self.assertEqual(row['rank_change'], -2)
        dropped = next(r for r in result['rows'] if r['code'] == '800001')
        self.assertIsNone(dropped['rank'])
        self.assertIsNone(dropped['history'][-1]['rank'])
        self.assertEqual(dropped['streak'], 0)

    def test_api_validation_success_and_failure(self):
        app = Flask(__name__); register_sector_routes(app); client = app.test_client()
        with patch('sector_research.fetch_snapshots', return_value=data()) as fetch:
            for query in ('source=bad', 'window=0', 'window=abc', 'date=bad'):
                self.assertEqual(client.get('/api/market/sectors/research?' + query).status_code, 400)
            fetch.assert_not_called()
            response = client.get('/api/market/sectors/research?date=2026-10-08&window=5')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['date'], '2026-10-08')
            self.assertEqual(client.get('/api/market/sectors/research?date=2020-01-01').status_code, 400)
        with patch('sector_research.fetch_snapshots', side_effect=requests.Timeout):
            response = client.get('/api/market/sectors/research')
            self.assertEqual(response.status_code, 502)
            self.assertFalse(response.json['success'])
            self.assertNotIn('rows', response.json)


if __name__ == '__main__':
    unittest.main()
