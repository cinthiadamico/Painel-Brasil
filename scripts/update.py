#!/usr/bin/env python3
"""Atualiza o Painel Brasil com metadados públicos de feeds RSS/Atom.

Sem LLM, sem republicar texto integral e sem alegar verificação de fatos.
Falhas não removem notícias recentes já coletadas. O arquivo de 2026-10-16
é substituído tão logo exista uma coleta válida.
"""
from __future__ import annotations

import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import html
import json
import os
from pathlib import Path
import re
import sys
import unicodedata
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'site' / 'data' / 'news.json'
NOW = dt.datetime.now(dt.timezone.utc)
UTC = dt.timezone.utc
MAX_HOURS = 84
ELECTION_HOURS = 168
MAX_OUTPUT = 120
USER_AGENT = 'PainelBrasilRSS/1.0 (+human-readable source links; public feed metadata)'
CATEGORY_ORDER = ['Economia','Endividamento','Educação','Saúde','Segurança','Câmara e Senado','STF e Justiça','Governo federal','Política','Internacional']

# Feeds diretos são preferíveis. O Google Notícias é indicado explicitamente
# no cartão, e seu URL não é apresentado como URL direto do editor.
def news_query(query: str) -> str:
    return 'https://news.google.com/rss/search?' + urlencode({'q':query, 'hl':'pt-BR','gl':'BR','ceid':'BR:pt-419'})

SOURCES = [
    ('G1', 'https://g1.globo.com/rss/g1/', 'Política', False),
    ('G1 · Economia', 'https://g1.globo.com/rss/g1/economia/', 'Economia', False),
    ('Folha de S.Paulo', 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', None, False),
    ('VEJA', 'https://veja.abril.com.br/feed/', 'Política', False),
    ('The New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'Internacional', False),
    ('Agência Brasil', 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml', None, False),
    ('Agência Brasil · Política', 'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml', 'Política', False),
    ('Agência Brasil · Economia', 'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml', 'Economia', False),
    ('Agência Brasil · Educação', 'https://agenciabrasil.ebc.com.br/rss/educacao/feed.xml', 'Educação', False),
    ('Agência Brasil · Saúde', 'https://agenciabrasil.ebc.com.br/rss/saude/feed.xml', 'Saúde', False),
    ('Agência Brasil · Justiça', 'https://agenciabrasil.ebc.com.br/rss/justica/feed.xml', 'STF e Justiça', False),
    ('Agência Brasil · Internacional', 'https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml', 'Internacional', False),
    ('Agência Câmara', 'https://www.camara.leg.br/noticias/rss/ultimas-noticias', 'Câmara e Senado', False),
    ('Agência Senado', 'https://www12.senado.leg.br/noticias/feed/todasnoticias', 'Câmara e Senado', False),
    ('O Globo', news_query('site:oglobo.globo.com OR site:oglobo.globo.com.br when:4d'), None, True),
    ('Estadão', news_query('site:estadao.com.br when:4d'), None, True),
    ('G1 · Busca alternativa', news_query('site:g1.globo.com when:4d'), None, True),
    ('Folha · Busca alternativa', news_query('site:folha.uol.com.br when:4d'), None, True),
    ('VEJA · Busca alternativa', news_query('site:veja.abril.com.br when:4d'), None, True),
    ('Eleições · Lula', news_query('"Lula" "eleições 2026" proposta apoio articulação when:7d'), 'Eleições', True),
    ('Eleições · Flávio', news_query('"Flávio Bolsonaro" "eleições 2026" proposta apoio articulação when:7d'), 'Eleições', True),
]

NOISE = re.compile(r'\b(videos?|ao vivo|fotos?|horoscopo|novela|loteria|futebol|bbb)\b',re.I)
TAG = re.compile(r'<[^>]*>')
SPACE = re.compile(r'\s+')
URL_ACCEPTED = {'http','https'}
STOP = {'a','o','as','os','de','da','do','das','dos','um','uma','e','em','no','na','nos','nas','para','com','por','que','pelo','pela','ao','aos','ou','sobre','apos','brasil','novo','novas','entre','tem','mais','ser','sao','pela','se','como','onde','nao'}


def tidy(text: str) -> str:
    text = re.sub(r'(?i)<(script|style)[^>]*>.*?</\1>', ' ', text or '', flags=re.S)
    return SPACE.sub(' ', html.unescape(TAG.sub(' ', text or ''))).strip()


def text_of(node: ET.Element, *names: str) -> str:
    for name in names:
        tag = name.rsplit(':',1)[-1]
        for child in node:
            if child.tag.rsplit('}',1)[-1] == tag:
                if (child.text or '').strip():return tidy(child.text or '')
                if child.attrib.get('href'):return child.attrib['href']
    return ''


def parse_date(raw: str) -> dt.datetime | None:
    if not raw: return None
    try: parsed=email.utils.parsedate_to_datetime(raw)
    except (ValueError,TypeError):
        try: parsed=dt.datetime.fromisoformat(raw.replace('Z','+00:00'))
        except ValueError:return None
    if parsed.tzinfo is None: parsed=parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def valid_link(link: str) -> bool:
    try:
        u=urlsplit(link)
        return u.scheme in URL_ACCEPTED and bool(u.netloc) and not u.username and not u.password
    except ValueError: return False


def canonical(link: str) -> str:
    p=urlsplit(link)
    q=[(k,v) for k,v in parse_qsl(p.query) if not k.lower().startswith(('utm_','fbclid','gclid'))]
    return urlunsplit((p.scheme,p.netloc.lower(),p.path.rstrip('/'),urlencode(q),''))


def normalize(txt: str) -> str:
    txt=unicodedata.normalize('NFKD',txt.lower())
    return ''.join(c for c in txt if not unicodedata.combining(c))


def words(txt: str) -> set[str]:
    return {w for w in re.findall(r'[a-z0-9]{3,}', normalize(txt)) if w not in STOP}


def category(title: str, fallback: str | None) -> str:
    t=normalize(title)
    patterns=[
      ('Endividamento',r'\b(divida publica|endividamento|deficit|orcamento|arcabouco fiscal|resultado primario|tesouro nacional|precat[óo]rios)\b'),
      ('STF e Justiça',r'\b(stf|supremo|tse|justica eleitoral|ministro do supremo|inquerito|pgr|tribunal superior)\b'),
      ('Câmara e Senado',r'\b(camara dos deputados|senado|senadores|deputados|pec |projeto de lei|comissao|congresso|plenario)\b'),
      ('Educação',r'\b(escola|educacao|professor|universidade|enem|fundeb|alfabetizac|ensino|estudantes)\b'),
      ('Saúde',r'\b(saude|sus|vacina|hospital|dengue|medicament|doenc|oms|tratamento|epidemi)\b'),
      ('Segurança',r'\b(seguranca publica|crime|policia|trafico|facc|homicidio|violencia|presidio)\b'),
      ('Economia',r'\b(inflacao|juros|selic|pib|mercado|emprego|ibge|banco central|dolar|investiment|industria|exportac)\b'),
      ('Internacional',r'\b(exterior|internacional|eua|estados unidos|china|onu|guerra|ucrania|russia|israel|mercosul|tarifa|embaixador|diplomacia|acordo comercial)\b'),
      ('Governo federal',r'\b(ministerio|governo federal|planalto|ministro|presidencia da republica|decreto|executivo federal)\b')
    ]
    for cat,regex in patterns:
        if re.search(regex,t):return cat
    return fallback if fallback in CATEGORY_ORDER else 'Política'


def election_candidate(title: str, description: str, forced: str | None=None) -> str | None:
    t=normalize(title+' '+description[:150])
    fl=bool(re.search(r'flavio\s+(?:bolsonaro|nas eleicoes)|senador flavio',t))
    lu=bool(re.search(r'\blula\b|luiz inacio',t))
    # Reportagens comparativas não são atribuídas a nenhum dos lados.
    if fl and lu:return None
    if fl:return 'flavio'
    if lu:return 'lula'
    return None


def election_slot(title: str) -> str | None:
    t=normalize(title)
    if re.search(r'\b(proposta|programa|plano de governo|promete|propoe|defende medida|pretende|quer criar|quer ampliar)\b',t):return 'Proposta'
    if re.search(r'\b(apoio|apoia|endossa|apoiadores?|declara apoio|com apoio de|recebe apoio)\b',t):return 'Apoiador'
    if re.search(r'\b(articula|articulacao|negocia|reuniao|alian[çc]a|partido|diretorios|coligacao|governadores|campanha se reuniu)\b',t):return 'Articulação'
    if re.search(r'\b(diz|afirma|declara|discursa|critica|defende|responde|fala|anuncia|promete|sustenta|comenta|discute)\b',t):return 'Fala'
    return None


def short_summary(title: str, source: str) -> str:
    """Sinopse original sem leitura ou paráfrase indevida da matéria completa."""
    t=title.rstrip('.:!')
    # Repetir apenas o núcleo da manchete, sem copiar descrição da editora.
    t=re.sub(r'\s+[-–—|]\s+(?:G1|Folha.*|Veja|Estadão|O Globo|The New York Times).*$', '', t, flags=re.I)
    t=t[:155].rstrip(' ,;')
    return f'O veículo {source} publicou uma atualização sobre: {t.lower()[0:1]+t[1:] if t else "tema em destaque"}. Consulte a reportagem para contexto, dados e declarações.'


def item_from_entry(node: ET.Element, name: str, default_cat: str | None, via: bool) -> dict | None:
    title=text_of(node,'title')
    link=text_of(node,'link')
    if not link:
        for child in node:
            if child.tag.rsplit('}',1)[-1] == 'link' and child.attrib.get('href'):
                link=child.attrib['href'];break
    published=parse_date(text_of(node,'pubDate','published','updated','date'))
    if not title or not valid_link(link) or not published:return None
    if published > NOW+dt.timedelta(hours=4):return None
    age_hours=(NOW-published).total_seconds()/3600
    if age_hours < -4 or age_hours > ELECTION_HOURS:return None
    description=text_of(node,'description','summary','content')
    # Fonte de Google News: se houver etiqueta <source>, preservar nome da editora.
    provider=text_of(node,'source') or name
    if ' · ' in provider:provider=provider.split(' · ')[0]
    if via and name.startswith('Eleições') and provider==name:provider='Veículo via Google Notícias'
    if via and provider==name and ' · ' in name:provider=name.split(' · ')[0]
    if via and provider=='Veículo via Google Notícias' and name=='Eleições · Lula':pass
    if not via and ' · ' in name:provider=name.split(' · ')[0]
    if NOISE.search(title) and not re.search(r'(congresso|governo|eleic)', normalize(title)):return None
    candidate=election_candidate(title,description)
    slot=election_slot(title) if candidate else None
    election_keywords=re.search(r'\b(eleic|candidat|segundo turno|campanha|presidenc)\w*', normalize(title+' '+description[:120]))
    if candidate and slot and (default_cat=='Eleições' or election_keywords):
        cat='Eleições'
    else:cat=category(title,default_cat)
    # NYT: restringe a relações com Brasil ou geopolítica/guerras.
    if name=='The New York Times' and not re.search(r'\b(brazil|brasil|united states|china|russia|ukraine|war|israel|iran|tariffs?|diplomacy|trade)\b',title,re.I):return None
    if cat!='Eleições' and age_hours>MAX_HOURS:return None
    # Links RSS via Google são identificados como via agregador.
    is_aggregator=via or urlsplit(link).netloc.endswith('news.google.com')
    if is_aggregator and urlsplit(link).netloc.endswith('news.google.com') is False:
        is_aggregator=False
    return {'id':hashlib.sha256((canonical(link)+'|'+(candidate or '')+'|'+(slot or '')).encode()).hexdigest()[:16],
            'title':title[:240], 'summary':short_summary(title,provider), 'url':link,
            'source':provider, 'published_at':published.isoformat(), 'category':cat,
            'candidate':candidate if cat=='Eleições' else None,
            'election_type':slot if cat=='Eleições' else None,
            'via_aggregator':is_aggregator,'curated':False,'archive':False}


def parse_feed(xml_bytes: bytes, source: tuple) -> list[dict]:
    root=ET.fromstring(xml_bytes)
    entries=[n for n in root.iter() if n.tag.rsplit('}',1)[-1] in ('item','entry')]
    result=[]
    for node in entries:
        item=item_from_entry(node,source[0],source[2],source[3])
        if item:result.append(item)
    return result


def fetch(source: tuple) -> tuple[str,list[dict],str | None]:
    name,url,_,_=source
    try:
        req=Request(url,headers={'User-Agent':USER_AGENT,'Accept':'application/rss+xml, application/atom+xml, text/xml, application/xml;q=0.9','Accept-Language':'pt-BR,pt;q=0.9'})
        with urlopen(req,timeout=16) as response:
            content=response.read(3_500_000)
        items=parse_feed(content,source)
        return name,items,None
    except Exception as exc:
        return name,[],f'{type(exc).__name__}: {str(exc)[:130]}'


def similarity(a: dict,b: dict) -> float:
    wa,wb=words(a['title']),words(b['title'])
    if not wa or not wb:return 0
    return len(wa&wb)/len(wa|wb)



def topic_key(item: dict) -> str | None:
    """Assuntos em que uma manchete posterior substitui etapa anterior.

    Escopo restrito: evita confundir projetos distintos com a mesma categoria.
    """
    t=normalize(item['title'])
    if re.search(r'\bpec (?:da |de )?seguranca\b|\bpec 18[/\-]2025\b',t):
        return 'pec-seguranca'
    if re.search(r'\b(escala )?6 ?[x×] ?1\b|\bfim da escala seis por um\b',t):
        return 'escala-6x1'
    m=re.search(r'\b(?:pec|plp|pl)\s*(?:n[ºo.]\s*)?(\d{1,5})[/\-](20\d{2})\b',t)
    if m:return 'projeto-'+m.group(1)+'-'+m.group(2)
    return None


def consolidate(items: list[dict]) -> list[dict]:
    """Escolhe a versão mais nova de manchetes sobre o mesmo evento.

    Não é verificação semântica de leis/decisões: em caso de incerteza, mantém
    apenas notícias recentes e suas datas, e nunca mistura arquivo histórico.
    """
    out=[];seen_urls=set();seen_titles=set()
    for item in sorted(items,key=lambda i:i['published_at'],reverse=True):
        u=canonical(item['url'])
        norm=re.sub(r'[^a-z0-9]','',normalize(item['title']))
        group=(item.get('candidate'),item.get('election_type')) if item.get('category')=='Eleições' else (item.get('category'),)
        if (u,group) in seen_urls or (norm,group) in seen_titles:continue
        key=topic_key(item)
        # Atualizações de uma mesma PEC conhecida não coexistem com estágios antigos.
        if key and any(topic_key(k)==key for k in out):continue
        # Sustenta novas versões sobre mesmo tema: as antigas não aparecem juntas.
        if any((group == ((k.get('candidate'),k.get('election_type')) if k.get('category')=='Eleições' else (k.get('category'),)) and
                similarity(item,k)>=0.60) for k in out):continue
        seen_urls.add((u,group));seen_titles.add((norm,group));out.append(item)
    return out


def select_items(items: list[dict]) -> list[dict]:
    clean=consolidate(items)
    elections=[x for x in clean if x['category']=='Eleições' and x.get('candidate') and x.get('election_type')]
    selection=[]
    for cand in ('lula','flavio'):
        for typ in ('Fala','Proposta','Apoiador','Articulação'):
            candidates=[x for x in elections if x['candidate']==cand and x['election_type']==typ]
            if candidates:selection.append(candidates[0])
    others=[x for x in clean if x['category']!='Eleições']
    counts={};providers={}
    for x in sorted(others,key=lambda i:i['published_at'],reverse=True):
        cat=x['category'];source=x['source']
        if counts.get(cat,0)>=12 or providers.get(source,0)>=20:continue
        selection.append(x);counts[cat]=counts.get(cat,0)+1;providers[source]=providers.get(source,0)+1
        if len(selection)>=MAX_OUTPUT:break
    return sorted(selection,key=lambda i:i['published_at'],reverse=True)


def run():
    try:old=json.loads(DEST.read_text(encoding='utf8'))
    except (OSError,ValueError):old={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=9) as executor:
        results=list(executor.map(fetch,SOURCES))
    health={name:{'status':'erro' if err else 'ok','items':len(news), **({'detail':err} if err else {})} for name,news,err in results}
    good=sum(1 for _,_,err in results if err is None)
    incoming=[x for _,records,_ in results for x in records]
    old_fresh=[x for x in old.get('items',[]) if not x.get('archive') and
               parse_date(x.get('published_at','')) and
               (NOW-parse_date(x['published_at'])).total_seconds() <= (ELECTION_HOURS if x.get('category')=='Eleições' else MAX_HOURS)*3600]
    if incoming:
        items=select_items(incoming+old_fresh)
        status='atualizado' if good==len(SOURCES) else 'parcial'
        last_success=NOW.isoformat()
    elif old_fresh:
        items=select_items(old_fresh)
        status='sem_novidades'
        last_success=old.get('last_success_at')
    else:
        # Uma pane geral NÃO deve transformar o arquivo inicial em notícia recente.
        items=old.get('items',[])
        status='arquivo_inicial' if old.get('status')=='arquivo_inicial' else 'erro_de_coleta'
        last_success=old.get('last_success_at')
    payload={'schema_version':1,'status':status,'last_checked_at':NOW.isoformat(),
             'last_success_at':last_success,'coverage_window_hours':MAX_HOURS,
             'items':items,'source_health':health,
             'notes':['Atualização baseada em RSS/Atom; não se trata de verificação integral de conteúdo.',
                      'Feed Google Notícias identificado como via agregador. Links originais fornecidos quando o RSS oficial os disponibiliza.',
                      'Sem matéria verificada para alguma posição eleitoral: o espaço permanece vazio.']}
    DEST.parent.mkdir(parents=True,exist_ok=True)
    temp=DEST.with_suffix('.json.tmp')
    temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    temp.replace(DEST)
    print(json.dumps({'status':status,'feeds_sucesso':good,'feeds_total':len(SOURCES),
                      'novos_registros':len(incoming),'exibidos':len(items),'destino':str(DEST)},ensure_ascii=False))
    # Erro de todas as fontes sai com status 0 para GitHub Pages publicar um aviso
    # de indisponibilidade no site em vez de prender a versão anterior em silêncio.

if __name__ == '__main__':run()
