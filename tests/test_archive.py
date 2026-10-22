import datetime as dt
import json
import pathlib
import tempfile
import unittest
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
import archive as a
import update as u

class MonthlyArchiveTest(unittest.TestCase):
    def example(self, id, published_at):
        return {
            'id': id, 'title': 'Câmara vota projeto de lei '+id,
            'source': 'Agência Câmara', 'category': 'Câmara e Senado',
            'published_at': published_at, 'url': 'https://exemplo.org/'+id,
        }

    def test_date_uses_brasilia(self):
        item=self.example('x','2026-10-22T02:20:00+00:00')
        self.assertEqual(a.publication_day(item), '2026-10-21')

    def test_monthly_folders_and_index(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder)
            inp=root/'news.json'
            date='2026-10-21T17:00:00+00:00'
            inp.write_text(json.dumps({'items':[self.example('a',date)]}),encoding='utf-8')
            folder_path=root/'archive'
            first=a.write_archive(inp,folder_path,dt.datetime(2026,10,22,tzinfo=dt.timezone.utc))
            target=folder_path/'2026-10'/'2026-10-21'/'materias.json'
            self.assertTrue(target.exists())
            self.assertEqual(json.loads(target.read_text(encoding='utf-8'))['items'][0]['id'],'a')
            self.assertTrue((folder_path/'2026-10'/'2026-10-16'/'materias.json').exists())
            index=json.loads((folder_path/'index.json').read_text(encoding='utf-8'))
            self.assertTrue(any(d['date']=='2026-10-21' for m in index['months'] for d in m['days']))
            self.assertGreaterEqual(first['saved_days'], 2)
            # Nova coleta nao apaga materias de dias anteriores.
            inp.write_text(json.dumps({'items':[self.example('b','2026-10-22T12:00:00+00:00')]}),encoding='utf-8')
            second=a.write_archive(inp,folder_path,dt.datetime(2026,10,22,13,tzinfo=dt.timezone.utc))
            self.assertTrue(target.exists())
            self.assertTrue((folder_path/'2026-10'/'2026-10-22'/'materias.json').exists())
            self.assertGreaterEqual(second['saved_days'],3)

    def test_reserve_metropoles_in_selection(self):
        ts=u.NOW.isoformat()
        def item(id,src,cat):
            return dict(id=id,title='Congresso vota pauta '+id,
                        source=src, category=cat, published_at=ts,
                        url='https://exemplo.org/'+id,candidate=None,election_type=None)
        items=[item(str(i),'Outra fonte','Câmara e Senado') for i in range(40)]
        items.append(item('metro','Metrópoles','Câmara e Senado'))
        results=u.select_items(items)
        self.assertTrue(any(i['source']=='Metrópoles' for i in results))
        self.assertEqual(u.MAX_HOURS,168)

if __name__ == '__main__':
    unittest.main()
