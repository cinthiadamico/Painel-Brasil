(() => {
  'use strict';
  const PORTALS = [
    ['G1', 'https://g1.globo.com/', 'Notícias brasileiras e cobertura nacional.'],
    ['O Globo', 'https://oglobo.globo.com/', 'Política, economia e assuntos do Brasil.'],
    ['Folha de S.Paulo', 'https://www1.folha.uol.com.br/', 'Cobertura de política, Brasil e economia.'],
    ['Estadão', 'https://www.estadao.com.br/', 'Noticiário nacional e internacional.'],
    ['VEJA', 'https://veja.abril.com.br/', 'Política, atualidades e economia.'],
    ['The New York Times', 'https://www.nytimes.com/', 'Geopolítica, economia mundial e Brasil no exterior.']
  ];
  const CAT = ['Economia', 'Endividamento', 'Educação', 'Saúde', 'Segurança', 'Câmara e Senado', 'STF e Justiça', 'Governo federal', 'Política', 'Internacional'];
  const SLOTS = ['Fala', 'Proposta', 'Apoiador', 'Articulação'];
  const $ = id => document.getElementById(id);
  let payload = null;
  let currentFilter = 'Todas';
  let lastFingerprint = '';

  function el(name, cls, content) {
    const n = document.createElement(name);
    if (cls) n.className = cls;
    if (content !== undefined && content !== null) n.textContent = String(content);
    return n;
  }
  function human(ts) {
    if (!ts) return 'Não informado';
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return 'Não informado';
    return new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo',day:'2-digit', month:'short',hour:'2-digit',minute:'2-digit'}).format(d).replace('.', '');
  }
  function safeUrl(url) {
    try { const u = new URL(url); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
  }
  function mkLink(url, label) {
    const a = el('a','read-more',label+' ↗');
    a.href = safeUrl(url) || '#'; a.target='_blank'; a.rel='noopener noreferrer';
    return a;
  }
  function entryCard(item, options={}) {
    const article=el('article',options.highlight ? 'highlight' : options.candidate ? 'card card-cand' : 'card');
    article.dataset.category=item.category || '';
    if (options.candidate) article.style.borderTopColor = options.candidate === 'lula' ? 'var(--cand-lula)' : 'var(--cand-flavio)';
    const kicker=el('div', options.highlight?'overline':'card-kicker');
    const title=el('span','',options.slot || item.category || 'NOTÍCIAS');
    kicker.append(title);
    if (!options.highlight) {
      const dt=el('time','',human(item.published_at));
      if(item.published_at) dt.dateTime = item.published_at;
      kicker.append(dt);
    }
    article.append(kicker,el('h3','',item.title),el('p','',item.summary || 'Leia a matéria para detalhes.'));
    const foot=el('div','card-foot');
    const src=el('span','source',item.source + (item.via_aggregator ? ' · via Google Notícias' : ''));
    foot.append(src,mkLink(item.url,item.via_aggregator?'Abrir via agregador':'Ler mais'));
    article.append(foot);
    return article;
  }
  function missingCard(slot) {
    const card=el('article','card card-cand');
    card.style.borderTopColor = 'var(--line)';
    card.append(el('div','card-kicker',slot),el('h3','','Sem registro recente confirmado'),el('p','','Não foi identificada matéria recente que corresponda a esta modalidade. A posição permanece vazia para preservar a simetria.'));
    return card;
  }
  function headerSection(cat, list) {
    const s=el('section','section category-section'); s.dataset.section=cat;
    const head=el('div','section-head'); const block=el('div');
    block.append(el('span','overline','EDITORIA'),el('h2','',cat));
    head.append(block,el('span','section-count',String(list.length).padStart(2,'0')+' notícias'));
    const cards=el('div','cards');
    if (list.length) list.forEach(x=>cards.append(entryCard(x)));
    else cards.append(el('div','empty-note','Nenhuma matéria recente coletada nesta editoria.'));
    s.append(head,cards);return s;
  }
  function setFilter(v, updateUrl=true) {
    currentFilter=v;
    document.querySelectorAll('.filter-chip').forEach(b=>{
      const active=b.dataset.filter===v;
      b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
    document.querySelectorAll('[data-section]').forEach(s=>s.hidden=(v!=='Todas'&&s.dataset.section!==v));
    $('contexto').hidden=(v!=='Todas'&&v!=='Eleições');
    if (updateUrl) { const u=new URL(location.href); if(v==='Todas')u.searchParams.delete('categoria'); else u.searchParams.set('categoria',v); history.replaceState(null,'',u); }
  }
  function render(p) {
    payload=p;
    const items=Array.isArray(p.items)?p.items:[];
    const count = (cat)=>cat==='Todas' ? items.length : cat==='Portais'?6:cat==='Eleições'? items.filter(x=>x.category==='Eleições').length : cat==='Destaques'?Math.min(3,items.length):items.filter(x=>x.category===cat).length;
    const filters=$('filters'); filters.replaceChildren();
    ['Todas','Portais','Eleições',...CAT].forEach(cat=>{
      const b=el('button','filter-chip'); b.type='button'; b.dataset.filter=cat;
      b.append(document.createTextNode(cat+' '),el('span','',count(cat)));
      b.addEventListener('click',()=>setFilter(cat));filters.append(b);
    });
    const top=items.filter(x=>x.category!=='Eleições').slice(0,3);
    const highlights=$('highlights');highlights.replaceChildren();
    if(top.length) top.forEach(x=>highlights.append(entryCard(x,{highlight:true})));
    else highlights.append(el('div','empty-note','Sem destaques disponíveis.'));
    $('count-destaques').textContent=top.length+' notícias';
    const portals=$('portal-grid');portals.replaceChildren();
    PORTALS.forEach(([name,url,description])=>{
      const c=el('article','card portal-card');
      c.append(el('span','portal-mark','PORTAL SELECIONADO'),el('h3','',name),el('p','',description));
      const f=el('div','card-foot');f.append(el('span','source','SITE OFICIAL'),mkLink(url,'Acessar portal'));c.append(f);portals.append(c);
    });
    const candidates=$('candidate-wrap');candidates.replaceChildren();
    [['lula','Lula'],['flavio','Flávio Bolsonaro']].forEach(([cand,name])=>{
      const col=el('div','candidate-col '+cand); const heading=el('div','candidate-heading');
      heading.append(el('span','dot'),el('h3','',name),el('small','','04 posições'));col.append(heading);
      const cards=el('div','candidate-cards');
      SLOTS.forEach(slot=>{
        const found=items.filter(x=>x.candidate===cand && x.election_type===slot).sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0))[0];
        cards.append(found?entryCard(found,{candidate:cand,slot}):missingCard(slot));
      });
      col.append(cards);candidates.append(col);
    });
    const cats=$('category-sections'); cats.replaceChildren();
    CAT.forEach(cat=>cats.append(headerSection(cat,items.filter(x=>x.category===cat).slice(0,12))));
    const footerSources=[...new Set(items.map(x=>x.source).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    $('footer-sources').textContent='Fontes com matérias efetivamente exibidas: '+(footerSources.join(', ')||'nenhuma')+'.';
    $('footer-success').textContent='Última coleta confirmada: '+(p.last_success_at?human(p.last_success_at):'nenhuma; conteúdo de referência')+'.';
    $('last-update').textContent=p.last_success_at?human(p.last_success_at):'Arquivo de 16.10.2026';
    $('total-label').textContent=items.length+' registros';
    const failed=Object.values(p.source_health || {}).filter(x=>x && x.status==='erro').length;
    const age=p.last_success_at ? (Date.now()-Date.parse(p.last_success_at))/3600000 : Infinity;
    const fresh=Number.isFinite(age)&&age<=2.5;
    $('status-dot').className='status-indicator '+(fresh?'ok':p.last_success_at?'fail':'');
    $('status-message').textContent=!p.last_success_at?'Arquivo inicial — coleta automática ainda não confirmada.':fresh?'Atualizado automaticamente; horários conforme fontes.':'Dados desatualizados: última coleta bem-sucedida há mais de 2h30.';
    $('status-count').textContent=failed?' · '+failed+' fonte(s) com falha na última tentativa.':'';
    const requested=new URL(location.href).searchParams.get('categoria');
    setFilter((requested && ['Todas','Portais','Eleições',...CAT].includes(requested))?requested:currentFilter,false);
  }
  async function refresh() {
    try {
      const res=await fetch('data/news.json?t='+Date.now(),{cache:'no-store'});
      if (!res.ok) throw Error('HTTP '+res.status);
      const result=await res.json();
      if (!Array.isArray(result.items)) throw Error('JSON inválido');
      const fingerprint=JSON.stringify([result.last_checked_at,result.last_success_at,result.items.length]);
      if(fingerprint!==lastFingerprint){lastFingerprint=fingerprint;render(result);}
    } catch(e) {
      if(!payload && window.PAINEL_SEED){render(window.PAINEL_SEED);}
      if(!payload){$('status-message').textContent='Dados não disponíveis: publique também data/news.json.';}
    }
  }
  function init() {
    const now=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'full'}).format(new Date());
    $('today-label').textContent='BRASIL · '+now.toUpperCase();
    const toggle=$('themeToggle');
    try { const t=localStorage.getItem('painel-tema'); if(t==='dark'||t==='light')document.documentElement.dataset.theme=t; else if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.dataset.theme='dark'; }catch{}
    toggle.addEventListener('click',()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;try{localStorage.setItem('painel-tema',t);}catch{}});
    refresh();window.setInterval(refresh,300000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  }
  init();
})();
