import datetime as dt
import pathlib
import sys
import tempfile
import unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
import import_claude as importer

class ClaudeImportTest(unittest.TestCase):
    def test_date_is_not_invented_when_missing(self):
        self.assertIsNone(importer.linked_date('Esta semana','2026-10-21'))
        self.assertIsNone(importer.linked_date('Em tramitação','2026-10-21'))
        self.assertEqual(importer.linked_date('19/10 · 20h19','2026-10-21'),
                         '2026-10-19T20:19:00-03:00')
        self.assertIsNone(importer.linked_date('32/10','2026-10-21'))

    def test_preserve_card_attribution(self):
        raw=('''<article class="card"><span class="tag">Proposta</span>'''
             '''<span class="time">20/10 · 14h10</span>'''
             '''<h3>Flávio apresenta nova proposta</h3>'''
             '''<p>Resumo informado no HTML exportado do Claude.</p>'''
             '''<div class="src"><a href="https://exemplo.com/abc">Metrópoles →</a></div>'''
             '''</article>''')
        news=importer.process_article(raw,'eleicoes','2026-10-21','flavio')
        self.assertEqual(news['source'],'Metrópoles')
        self.assertEqual(news['election_type'],'Proposta')
        self.assertTrue(news['claude_imported'])
        self.assertFalse(news['claude_verified'])
        self.assertIn('Resumo informado',news['summary'])

    def test_latest_edition_complete_and_balanced(self):
        original=pathlib.Path(__file__).resolve().parents[1]/'imports/claude/2026-10-21.html'
        if not original.exists():self.skipTest('Arquivo da edição não enviado')
        items=importer.extract(original.read_text(encoding='utf-8'),'2026-10-21')
        self.assertEqual(len(items),689)
        election=[x for x in items if x['section_id']=='eleicoes']
        self.assertEqual(len(election),266)
        self.assertEqual(sum(x['candidate']=='lula' for x in election),133)
        self.assertEqual(sum(x['candidate']=='flavio' for x in election),133)
        self.assertEqual(sum(x['section_id']=='destaques' for x in items),22)
        self.assertEqual(len(set(x['id'] for x in items)),len(items))

    def test_import_idempotent_and_dated(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)
            imp=root/'imports'
            imp.mkdir()
            (imp/'2026-10-21.html').write_text(
                '<section class="cat" data-cat="politica">'
                '<article class="card"><h3>Senado aprova teste</h3>'
                '<p>Texto original</p><a href="https://exemplo.org/teste">Agência Senado</a>'
                '</article></section>',encoding='utf-8')
            output=root/'site'/'arquivo'
            first=importer.run(imp,output)
            second=importer.run(imp,output)
            self.assertEqual(first['editions'],1)
            self.assertEqual(second['files_changed'],0)
            self.assertTrue((output/'2026-10'/'2026-10-21'/'claude.json').exists())

if __name__=='__main__':unittest.main()
