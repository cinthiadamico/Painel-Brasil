#!/usr/bin/env python3
"""Importa exportacoes HTML do Claude, preservando a autoria da edicao.

Os textos e pesquisas importados nao passam por checagem independente.
A data da edicao nunca substitui uma data de publicacao ausente.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import html
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
IMPORTS = ROOT / 'imports' / 'claude'
ARCHIVE = ROOT / 'site' / 'arquivo'
SECTIONS = {
    'eleicoes':'Eleições', 'ruas':'Brasil nas ruas',
    'politica':'Política', 'economia':'Economia',
    'justica':'STF e Justiça', 'camara':'Câmara e Senado',
    'senado':'Câmara e Senado', 'intl':'Internacional',
    'saude':'Saúde', 'edu':'Educação', 'seg':'Segurança',
    'destaques':'Destaques',
}
SECTION_RE = re.compile(r'<section\b[^>]*\bdata-cat="([^"]+)"[^>]*>(.*?)</section>', re.I|re.S)
ARTICLE_RE = re.compile(r'<article\b[^>]*\bclass="(?:card\b[^"]*|hero-card)"[^>]*>.*?</article>', re.I|re.S)
GROUP_RE = re.compile(r'<div\s+class="cand-group"[^>]*>', re.I)
DATE_RE = re.compile(r'\b(\d{1,2})/(\d{1,2})(?:/(20\d{2}))?\b')
CLOCK_RE = re.compile(r'\b(\d{1,2})h(\d{2})\b')
TITLE_RE = re.compile(r'<h[23]\b[^>]*>(.*?)</h[23]>', re.I|re.S)
P_RE = re.compile(r'<p\b[^>]*>(.*?)</p>', re.I|re.S)
LINK_RE = re.compile(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.I|re.S)
TAG_RE = re.compile(r'<span\b[^>]*class="tag"[^>]*>(.*?)</span>', re.I|re.S)
TIME_RE = re.compile(r'<span\b[^>]*class="time"[^>]*>(.*?)</span>', re.I|re.S)
HTML_TAG = re.compile(r'<[^>]+>')
WHITESPACE = re.compile(r'\s+')

def plain(text: str) -> str:
    return WHITESPACE.sub(' ', html.unescape(HTML_TAG.sub(' ', text or ''))).strip()

def linked_date(label: str, edition_date: str) -> str | None:
    """Apenas datas explicitamente impressas nos cards viram published_at."""
    found=DATE_RE.search(label)
    if not found:return None
    try:
        day,month,year=int(found[1]),int(found[2]),int(found[3] or edition_date[:4])
        dt.date(year,month,day)
        match=CLOCK_RE.search(label)
        hour,minute=(int(match[1]),int(match[2])) if match else (12,0)
        if hour>23 or minute>59:return None
        return dt.datetime(year,month,day,hour,minute,
                           tzinfo=dt.timezone(dt.timedelta(hours=-3))).isoformat()
    except ValueError:return None

def process_article(raw: str, section: str, edition_date: str,
                    candidate: str | None=None) -> dict | None:
    title_match=TITLE_RE.search(raw)
    links=LINK_RE.findall(raw)
    if not title_match or not links:return None
    title=plain(title_match[1])
    link=html.unescape(links[-1][0]).strip()
    try:
        url=urlsplit(link)
        if url.scheme not in ('http','https') or not url.netloc:return None
    except ValueError:return None
    if not title:return None
    desc=P_RE.search(raw)
    source=plain(links[-1][1]).rstrip(' →↗') or 'Fonte indicada no Claude'
    timematch=TIME_RE.search(raw)
    time_label=plain(timematch[1]) if timematch else ''
    tag=TAG_RE.search(raw)
    election_type=plain(tag[1]) if tag else None
    if section!='eleicoes':election_type=None;candidate=None
    return {
        'id':hashlib.sha256((section+'\n'+str(candidate)+'\n'+link+'\n'+title).encode('utf8')).hexdigest()[:16],
        'title':title,
        'summary':plain(desc[1]) if desc else '',
        'url':link, 'source':source,
        'section_id':section, 'category':SECTIONS.get(section,'Política'),
        'candidate':candidate, 'election_type':election_type,
        'time_label':time_label, 'published_at':linked_date(time_label,edition_date),
        'edition_date':edition_date, 'claude_imported':True, 'claude_verified':False,
        'archive':False, 'via_aggregator':False
    }

def extract(source_html: str, edition_date: str) -> list[dict]:
    output=[]
    for match in SECTION_RE.finditer(source_html):
        category,section=match.group(1),match.group(2)
        groups=[x.start() for x in GROUP_RE.finditer(section)]
        for article in ARTICLE_RE.finditer(section):
            candidate=None
            if category=='eleicoes' and groups and article.start()>groups[0]:
                candidate='flavio' if len(groups)>1 and article.start()>groups[1] else 'lula'
            item=process_article(article.group(),category,edition_date,candidate)
            if item:output.append(item)
    # Destaques sem metadado temporal: somente data da edicao e preservada.
    before=source_html.split('<!-- ELEIÇÕES:',1)[0]
    for match in ARTICLE_RE.finditer(before):
        if not match.group().startswith('<article class="hero-card"'):continue
        item=process_article(match.group(),'destaques',edition_date)
        if item:output.append(item)
    # Manter inclusive noticias distintas repetidas pela edicao original.
    used=set()
    for ordinal,item in enumerate(output):
        old=item['id']
        if old in used:item['id']=hashlib.sha256((old+'#'+str(ordinal)).encode('utf8')).hexdigest()[:16]
        used.add(item['id'])
    return output

def write_if_changed(path:Path, obj:dict)->bool:
    raw=json.dumps(obj,ensure_ascii=False,indent=2)+'\n'
    if path.exists() and path.read_text(encoding='utf8')==raw:return False
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(raw,encoding='utf8')
    return True

def run(root:Path=IMPORTS, archive:Path=ARCHIVE)->dict:
    editions=[];changed=0
    for path in sorted(root.glob('20??-??-??.html')):
        try:dt.date.fromisoformat(path.stem)
        except ValueError:continue
        items=extract(path.read_text(encoding='utf8'),path.stem)
        target=archive/path.stem[:7]/path.stem/'claude.json'
        snapshot={
            'schema_version':1, 'edition_date':path.stem,
            'imported_from':'Claude artifact — HTML fornecido pelo usuário',
            'verified':False, 'count':len(items), 'items':items,
            'note':'Textos e dados importados do Claude; não foram checados de maneira independente.'
        }
        changed+=int(write_if_changed(target,snapshot))
        editions.append({'edition_date':path.stem,
                         'path':f'arquivo/{path.stem[:7]}/{path.stem}/claude.json',
                         'count':len(items)})
    manifest={'schema_version':1,'editions':sorted(editions,key=lambda x:x['edition_date'],reverse=True)}
    changed+=int(write_if_changed(archive/'claude-index.json',manifest))
    return {'editions':len(editions),'files_changed':changed,
            'latest':editions[-1] if editions else None}

if __name__=='__main__':
    print(json.dumps(run(),ensure_ascii=False))
