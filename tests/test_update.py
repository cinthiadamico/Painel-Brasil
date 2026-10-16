import datetime as dt
import pathlib
import sys
import unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
import update as u

class CollectorTest(unittest.TestCase):
    def test_html_cleanup(self):
        self.assertEqual(u.tidy('<p>Texto <strong>simples</strong> &amp; claro</p>'), 'Texto simples & claro')
    def test_date(self):
        self.assertEqual(u.parse_date('Fri, 16 Oct 2026 10:30:00 -0300').hour,13)
    def test_rss_item(self):
        rss=f'''<rss version="2.0"><channel><item>
        <title>Senado discute projeto de lei sobre segurança</title>
        <link>https://www12.senado.leg.br/noticias/materias/abc</link>
        <pubDate>{u.NOW.strftime('%a, %d %b %Y %H:%M:%S +0000')}</pubDate>
        <description><![CDATA[<p>Resumo do Senado</p>]]></description>
        </item></channel></rss>'''
        items=u.parse_feed(rss.encode(),('Agência Senado','https://exemplo.test/rss', 'Câmara e Senado',False))
        self.assertEqual(len(items),1)
        self.assertEqual(items[0]['source'],'Agência Senado')
        self.assertFalse(items[0]['via_aggregator'])
        self.assertNotIn('Resumo do Senado',items[0]['summary'])
    def test_google_source(self):
        rss=f'''<rss><channel><item><title>Estadão apresenta nova análise sobre juros</title>
        <link>https://news.google.com/rss/articles/abc</link>
        <pubDate>{u.NOW.strftime('%a, %d %b %Y %H:%M:%S +0000')}</pubDate>
        <source url="https://www.estadao.com.br/">Estadão</source></item></channel></rss>'''
        items=u.parse_feed(rss.encode(),('Estadão','google news','Economia',True))
        self.assertEqual(items[0]['source'],'Estadão')
        self.assertTrue(items[0]['via_aggregator'])
    def test_url_safety(self):
        self.assertFalse(u.valid_link('javascript:alert(1)'))
        self.assertFalse(u.valid_link('https://name:secret@example.com/private'))
    def test_election_balanced_slots(self):
        news=[]
        for who in ['lula','flavio']:
            for key in ['Fala','Proposta','Apoiador','Articulação']:
                news.append({'id':who+key,'title':f'Assunto distinto sobre {who} {key}',
                'published_at':u.NOW.isoformat(),'url':f'https://teste.com/{who}/{key}',
                'source':'Teste', 'category':'Eleições','candidate':who,'election_type':key})
        self.assertEqual(len(u.select_items(news)),8)
        for who in ['lula','flavio']:
            self.assertEqual(len([x for x in u.select_items(news) if x['candidate']==who]),4)
    def test_archive_does_not_override_live(self):
        a={'id':'a','title':'PEC da Segurança avança para o Senado','url':'https://site.com/1','published_at':'2026-10-15T00:00:00+00:00','category':'Câmara e Senado','source':'Agência Brasil'}
        b=dict(a,id='b',title='PEC da Segurança avança para análise no Senado',url='https://site.com/2',published_at='2026-10-16T00:00:00+00:00')
        self.assertEqual(len(u.consolidate([a,b])),1)
        self.assertEqual(u.consolidate([a,b])[0]['id'],'b')

if __name__=='__main__':unittest.main()

class TopicTest(unittest.TestCase):
    def test_known_pec_replaces_previous_state(self):
        base={'published_at':'2026-10-16T10:00:00+00:00','category':'Câmara e Senado','source':'Teste','url':'https://teste.org/news/1','candidate':None,'election_type':None}
        a={**base,'title':'PEC da Segurança avança no Senado'}
        b={**base,'title':'PEC da Segurança retirada da pauta','published_at':'2026-10-16T13:00:00+00:00','url':'https://teste.org/news/2'}
        self.assertEqual([x['title'] for x in u.consolidate([a,b])],['PEC da Segurança retirada da pauta'])

class RegressionTest(unittest.TestCase):
    def _feed(self, title, default=None):
        from xml.sax.saxutils import escape
        rss=f'''<rss><channel><item><title>{escape(title)}</title>
        <link>https://exemplo.org/materia/123</link>
        <pubDate>{u.NOW.strftime('%a, %d %b %Y %H:%M:%S +0000')}</pubDate>
        </item></channel></rss>'''
        return u.parse_feed(rss.encode(),('G1','https://exemplo.org/rss',default,False))
    def test_entertainment_not_classified_as_politics(self):
        self.assertEqual(self._feed('As fantasias das celebridades em baile de Halloween em São Paulo'),[])
        self.assertEqual(self._feed('Quem era jovem que morreu em acidente de moto em Palmas'),[])
    def test_actual_civic_news_remains(self):
        items=self._feed('Senado retira PEC da Segurança da pauta')
        self.assertEqual(len(items),1)
        self.assertEqual(items[0]['category'],'Câmara e Senado')
    def test_not_candidate_statement_by_third_party(self):
        t='Líder do PT no Senado diz ter avisado Lula sobre apoio a proposta que reduz maioridade penal'
        self.assertIsNone(u.election_slot(t,u.election_candidate(t)))
    def test_not_candidate_support_based_on_mention(self):
        t='Pacheco no STF tem apoio na corte, mas aliados de Lula temem discussão na eleição'
        self.assertIsNone(u.election_slot(t,u.election_candidate(t)))
    def test_candidate_proposals_and_speech(self):
        cases=[('Lula promete passe livre nos fins de semana','lula','Proposta'),
               ('Flávio Bolsonaro discute proposta para mudar jornada','flavio','Proposta'),
               ('Flávio diz que participará do debate','flavio','Fala'),
               ('Lula negocia apoio de governadores','lula','Articulação'),
               ('Governador declara apoio a Lula no segundo turno','lula','Apoiador')]
        for title,candidate,expected in cases:
            with self.subTest(title=title):
                self.assertEqual(u.election_candidate(title),candidate)
                self.assertEqual(u.election_slot(title,candidate),expected)
    def test_cross_candidate_campaign_law_not_collapsed(self):
        template={'published_at':u.NOW.isoformat(),'category':'Eleições','source':'Fonte',
                  'election_type':'Proposta'}
        a={**template,'candidate':'lula','title':'Lula defende fim da escala 6x1','url':'https://a.test/1'}
        b={**template,'candidate':'flavio','title':'Flávio propõe escala 6x1 alternativa','url':'https://a.test/2'}
        self.assertEqual(len(u.consolidate([a,b])),2)
