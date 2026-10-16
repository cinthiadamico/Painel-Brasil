/* Painel Brasil: camada de notícias atuais sobre o layout original Claude.
   O HTML de 16/10 é mantido como arquivo; não é reclassificado como notícia recente. */
(() => {
  'use strict';
  const CATEGORIES = [
    ['politica','Política & Governo','--cat-politica'],
    ['governo','Governo federal e ministérios','--cat-politica'],
    ['economia','Economia','--cat-economia'],
    ['divida','Endividamento público','--cat-economia'],
    ['justica','Justiça & STF','--cat-justica'],
    ['camara','Câmara dos Deputados','--cat-camara'],
    ['senado','Senado','--cat-senado'],
    ['intl','Internacional & Geopolítica','--cat-intl'],
    ['saude','Saúde','--cat-saude'],
    ['edu','Educação','--cat-edu'],
    ['seg','Segurança & Geral','--cat-seg'],
    ['ruas','Brasil nas ruas','--cat-ruas']
  ];
  const PORTALS = [
    ['G1','https://g1.globo.com/','Notícias brasileiras'],
    ['O Globo','https://oglobo.globo.com/','Política, economia e Brasil'],
    ['Folha de S.Paulo','https://www1.folha.uol.com.br/','Reportagens e atualidades'],
    ['Estadão','https://www.estadao.com.br/','Notícias nacionais e internacionais'],
    ['VEJA','https://veja.abril.com.br/','Política e atualidades'],
    ['The New York Times','https://www.nytimes.com/','Mundo e Brasil no exterior']
  ];
  const SLOT_NAMES = ['Fala','Proposta','Apoiador','Articulação'];
  const ROOT = document.querySelector('.wrap');
  const HEADER = ROOT && ROOT.querySelector('header.masthead');
  const $ = (id) => document.getElementById(id);
  if (!ROOT || !HEADER) return;

  const node = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = String(text);
    return e;
  };
  function safeUrl(value) {
    try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) ? u.href : ''; }
    catch { return ''; }
  }
  function dateOf(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return 'Data indisponível';
    return new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  }
  function sectionTitle(title, color, count) {
    const head = node('div','cat-head');
    const dot = node('span','cat-dot'); dot.style.background = `var(${color})`;
    head.append(dot, node('h2','',title),node('span','cat-count',`${count} ${count === 1 ? 'matéria' : 'matérias'}`));
    return head;
  }
  function createCard(item, options = {}) {
    const card = node('article', 'card'+(options.candidate ? ' card-cand' : ''));
    card.dataset.cat = options.category || '';
    if (options.candidate) card.style.borderColor = `var(--cand-${options.candidate})`;
    const tagRow = node('div','tag-row');
    const tag = node('span','tag',options.slot || item.category || 'Notícia');
    tag.style.background = `var(${options.candidate ? '--cand-'+options.candidate : options.color || '--accent'})`;
    const time = node('span','time',dateOf(item.published_at));
    tagRow.append(tag,time);
    card.append(tagRow,node('h3','',item.title || 'Notícia sem título'));
    // Metadados RSS não permitem resumir integralmente a reportagem.
    const desc = item.curated && item.summary && !item.archive
      ? item.summary
      : 'Manchete identificada em feed de notícias. Consulte a reportagem original para contexto, dados e declarações.';
    card.append(node('p','',desc));
    const src = node('div','src');
    const publisher = node('strong','',item.source || 'Fonte identificada pelo feed');
    src.append(publisher,document.createTextNode(item.via_aggregator ? ' · via Google Notícias · ' : ' · '));
    const url = safeUrl(item.url);
    if (url) {
      const a = node('a','',item.via_aggregator ? 'Abrir notícia no agregador ↗' : 'Ler na fonte ↗');
      a.href = url; a.target='_blank'; a.rel='noopener noreferrer'; src.append(a);
    } else src.append(node('span','','Link não disponível'));
    card.append(src);
    return card;
  }
  function missingCard(slot, candidate) {
    const c = node('article','card card-cand'); c.style.borderColor=`var(--cand-${candidate})`;
    const row=node('div','tag-row'), tag=node('span','tag',slot);tag.style.background=`var(--cand-${candidate})`;
    row.append(tag,node('span','time','Sem registro recente'));
    c.append(row,node('h3','','Sem notícia recente identificada'),node('p','','A coleta não identificou notícia que comprove esta modalidade. O espaço permanece sem atribuição para preservar o equilíbrio.'));
    return c;
  }
  // Preserva as notícias fornecidas no HTML do Claude e redistribui cada uma
  // para a editoria correta. A edição original é um retrato de 16/10/2026,
  // não deve ser misturada às manchetes da coleta automática.
  const historical = new Map();
  const historicElection = {lula:[],flavio:[],general:[]};
  const historicStreets = {lula:[],flavio:[]};
  const originalHighlights = [...ROOT.querySelectorAll('.hero-grid > .hero-card')];
  const originalRace = ROOT.querySelector('.race');
  const originalElectionNote = ROOT.querySelector('section.cat[data-cat="eleicoes"] .context-note');
  const historicalLabel='Painel Claude · edição de 16/10/2026';

  function classifyHistorical(originalCategory, card) {
    const title=(card.querySelector('h3')?.textContent||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    // A editoria original prevalece; só há alterações com indício explícito.
    if (originalCategory==='politica') {
      if (/^stf|^tse|justica eleitoral/.test(title)) return 'justica';
      if (/^governo (regulamenta|lanca|pede)|rouanet games/.test(title)) return 'governo';
      if (/urnas/.test(title)) return 'eleicoes';
    }
    if (originalCategory==='economia') {
      if (/^zanin|^stf|^tse/.test(title)) return 'justica';
      if (/riscos fiscais|\borcamento\b|\bremanejar\b|\bcorte de gastos\b|divida publica|deficit publico|gastos publicos/.test(title)) return 'divida';
    }
    return originalCategory;
  }
  function labelHistoricalCard(card) {
    card.classList.add('historical-card');
    card.removeAttribute('data-cat');
    card.prepend(node('span','historical-badge','ARQUIVO · 16/10/2026'));
    return card;
  }
  for (const section of ROOT.querySelectorAll(':scope > section.cat')) {
    const sourceCat=section.dataset.cat;
    if(sourceCat==='eleicoes'||sourceCat==='ruas') {
      const groups=[...section.querySelectorAll('.cand-group')];
      groups.forEach((group,index)=>{
        const id=index===0?'lula':'flavio';
        const dest=sourceCat==='eleicoes'?historicElection:historicStreets;
        [...group.querySelectorAll('article.card')].forEach(card=>dest[id].push(labelHistoricalCard(card)));
      });
      if(sourceCat==='eleicoes') {
        const extra=[...section.querySelectorAll(':scope > .card-grid > article.card')];
        extra.forEach(card=>historicElection.general.push(labelHistoricalCard(card)));
      }
      continue;
    }
    section.querySelectorAll('article.card').forEach(card=>{
      const cat=classifyHistorical(sourceCat,card);
      if(!historical.has(cat))historical.set(cat,[]);
      historical.get(cat).push(labelHistoricalCard(card));
    });
  }
  originalHighlights.forEach(labelHistoricalCard);
  // Remove o arquivo único: o conteúdo histórico passa a aparecer na aba
  // correspondente, logo depois das notícias atualizadas daquela editoria.
  Array.from(ROOT.children).filter(el=>el!==HEADER).forEach(el=>el.remove());
  const live=node('div','live-content');live.id='edicao-atual';
  ROOT.append(live);

  const newFooter = node('footer','live-footer');newFooter.id='fontes-atuais';
  ROOT.append(newFooter);
  const updated=$('updatedAt');
  if (updated) updated.textContent='Edição atual: consultando fontes...';
  const themeBtn=node('button','theme-control','◐ Tema');
  themeBtn.type='button';themeBtn.setAttribute('aria-label','Alternar modo claro e escuro');
  themeBtn.addEventListener('click',()=>{
    const dark=matchMedia('(prefers-color-scheme: dark)').matches;
    const current=document.documentElement.dataset.theme || (dark?'dark':'light');
    document.documentElement.dataset.theme=current==='dark'?'light':'dark';
    themeBtn.setAttribute('aria-pressed',String(document.documentElement.dataset.theme==='dark'));
  });
  const status=HEADER.querySelector('.live-status');if(status)status.append(themeBtn);
  const nav=$('filters'); if (nav) nav.replaceWith(nav.cloneNode(false));
  const filters=$('filters');
  let allItems=[],active='todas',lastPayload=null;
  const filtersData = [
    ['todas','Todas'],['destaques','Destaques'],['portais','Portais'],['eleicoes','Eleições'],
    ['ruas','Brasil nas ruas'], ...CATEGORIES.filter(c=>c[0]!=='ruas').map(c=>[c[0],c[1]])
  ];
  function displaySection(cat){
    active=cat;
    Array.from(filters.querySelectorAll('button')).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===cat)));
    // Nunca filtrar artigos individualmente: os cards históricos têm a
    // classificação própria, mas pertencem à seção em que foram redistribuídos.
    Array.from(live.querySelectorAll('section.cat[data-cat]')).forEach(e=>{e.hidden=cat!=='todas'&&e.dataset.cat!==cat;});
  }
  filtersData.forEach(([key,label]) => {
    const chip=node('button','chip',label);chip.type='button';chip.dataset.filter=key;chip.setAttribute('aria-pressed',String(key==='todas'));
    chip.addEventListener('click',()=>displaySection(key));
    filters.append(chip);
  });

  function cardsGroup(items,color,cat='') {
    const grid=node('div','card-grid');
    if(!items.length) grid.append(node('p','empty-state','Nenhuma notícia recente encontrada para esta categoria nesta coleta.'));
    else items.forEach(x=>grid.append(createCard(x,{color,category:cat})));
    return grid;
  }
  function sortedRecent(items) {
    return [...items].sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0));
  }
  function classification(item) {
    const cat=item.category || 'Política';
    if (cat === 'Eleições') return 'eleicoes';
    if (cat === 'Brasil nas ruas') return 'ruas';
    if (cat === 'Governo federal') return 'governo';
    if (cat === 'Endividamento') return 'divida';
    if (cat === 'Educação') return 'edu';
    if (cat === 'Saúde') return 'saude';
    if (cat === 'Segurança') return 'seg';
    if (cat === 'Economia') return 'economia';
    if (cat === 'STF e Justiça') return 'justica';
    if (cat === 'Internacional') return 'intl';
    if (cat === 'Câmara e Senado') return /senad|senador|alcolumbre|senate/i.test((item.title || '')+' '+(item.source || '')) ? 'senado' : 'camara';
    return 'politica';
  }
  function normalizeSource(str) {
    return String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  }
  function renderPortals(items,sourceHealth={}) {
    const sec=node('section','cat');sec.dataset.cat='portais';
    sec.append(sectionTitle('Portais de notícias','--accent',PORTALS.length));
    const grid=node('div','card-grid');
    PORTALS.forEach(([name,url,description])=>{
      const card=node('article','card');card.append(node('h3','',name));
      const matches=sortedRecent(items.filter(i=>normalizeSource(i.source)===normalizeSource(name)));
      const n=matches.length;
      card.append(node('p','',`${description}. ${n} ${n===1?'matéria recente':'matérias recentes'} na edição atual.`));
      const health=sourceHealth[name];
      if (health) {
        const status=health.status==='erro'
          ? 'Falha temporária na coleta deste veículo'
          : (name==='O Globo'||name==='Estadão'
             ? 'Manchetes consultadas via Google Notícias'
             : 'Feed de notícias respondendo');
        card.append(node('p','portal-feed-status',status));
      }
      const links=node('ul','portal-news');
      matches.slice(0,3).forEach(i=>{
        const li=node('li'); const a=node('a','',i.title||'Abrir matéria');
        a.href=safeUrl(i.url);a.target='_blank';a.rel='noopener noreferrer';
        li.append(a,node('span','portal-date',dateOf(i.published_at)));links.append(li);
      });
      if(matches.length) card.append(links);
      else card.append(node('p','portal-no-news','Nenhuma manchete recente coletada deste veículo. O acesso ao portal continua disponível.'));
      const src=node('div','src');const a=node('a','','Acessar site oficial ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';src.append(a);card.append(src);grid.append(card);
    });
    sec.append(grid,node('p','small-note','A indicação de fonte e o horário vêm dos feeds ou agregadores. Um link de agregador não representa acesso automático ao texto integral do veículo.'));
    return sec;
  }
  function historicalIntro(count){
    const wrap=node('div','historical-heading');
    wrap.append(node('h3','',`Do painel Claude · 16/10/2026 (${count})`),
      node('p','','Arquivo histórico: títulos, resumos e datas da edição recebida, sem atualização ou verificação automática. Consulte os links originais.'));
    return wrap;
  }
  function appendHistorical(section, cat){
    const cards=historical.get(cat)||[];
    if(!cards.length)return;
    const area=node('div','historical-section');
    area.append(historicalIntro(cards.length));
    const grid=node('div','card-grid');cards.forEach(card=>grid.append(card));
    area.append(grid);section.append(area);
  }
  function electionSection(items) {
    const sec=node('section','cat');sec.dataset.cat='eleicoes';
    const totalArchive=historicElection.lula.length+historicElection.flavio.length+historicElection.general.length+(historical.get('eleicoes')||[]).length;
    sec.append(sectionTitle('Eleições 2026: Lula × Flávio','--cand-lula',8+totalArchive));
    sec.append(node('p','small-note','Notícias recentes: quatro posições para cada candidato. Abaixo de cada grupo estão as matérias originais do Claude, identificadas como arquivo de 16/10/2026. Quantidades iguais para Lula e Flávio no arquivo.'));
    [['lula','Lula'],['flavio','Flávio Bolsonaro']].forEach(([id,name])=>{
      const group=node('div','cand-group');const label=node('h3','cand-label',name);label.style.color=`var(--cand-${id})`;group.append(label);
      const grid=node('div','card-grid');
      SLOT_NAMES.forEach(slot=>{
        const found=sortedRecent(items.filter(i=>i.candidate===id && i.election_type===slot))[0];
        grid.append(found?createCard(found,{candidate:id,slot,category:'eleicoes'}):missingCard(slot,id));
      });
      group.append(node('p','small-note','Notícias recentes · 4 posições'),grid);
      const historicalCards=historicElection[id];
      if(historicalCards.length){
        const archiveGroup=node('div','historical-section');archiveGroup.append(historicalIntro(historicalCards.length));
        const archiveGrid=node('div','card-grid');historicalCards.forEach(card=>archiveGrid.append(card));
        archiveGroup.append(archiveGrid);group.append(archiveGroup);
      }
      sec.append(group);
    });
    const extras=(historical.get('eleicoes')||[]).concat(historicElection.general);
    if(extras.length){
      const area=node('div','historical-section');area.append(historicalIntro(extras.length));
      const title=node('h3','historical-subhead','Outras notícias sobre as eleições');area.append(title);
      const grid=node('div','card-grid');extras.forEach(card=>grid.append(card));area.append(grid);sec.append(area);
    }
    if(originalRace){
      const polls=node('details','historical-context');
      polls.append(node('summary','','Pesquisas e contexto eleitoral da edição de 16/10 — somente arquivo histórico'),
        node('p','archive-explain','Resultados registrados no painel recebido. Estes números não são atualizados e não devem ser interpretados como pesquisas atuais.'),originalRace);
      sec.append(polls);
    }
    if(originalElectionNote){
      const note=node('div','historical-context-note');note.append(node('span','historical-badge',historicalLabel),originalElectionNote);
      sec.append(note);
    }
    return sec;
  }
  function streetSection(items){
    const sec=node('section','cat');sec.dataset.cat='ruas';
    const recent=items.filter(i=>classification(i)==='ruas');
    const old=historicStreets.lula.length+historicStreets.flavio.length;
    sec.append(sectionTitle('Brasil nas ruas: apoio e oposição pelos estados','--cat-ruas',recent.length+old));
    if(recent.length){
      sec.append(node('h3','historical-subhead','Notícias recentes'),cardsGroup(recent,'--cat-ruas','ruas'));
    }
    [['lula','Atos de apoio a Lula'],['flavio','Atos de oposição / pró-Flávio']].forEach(([id,label])=>{
      const cards=historicStreets[id];
      const group=node('div','cand-group historical-section');
      const h=node('h3','cand-label',label);h.style.color=`var(--cand-${id})`;
      group.append(h,historicalIntro(cards.length));
      const grid=node('div','card-grid');cards.forEach(c=>grid.append(c));group.append(grid);sec.append(group);
    });
    return sec;
  }
  function highlights(items) {
    const sec=node('section','cat');sec.dataset.cat='destaques';
    const recent=sortedRecent(items.filter(i=>classification(i)!=='eleicoes'));
    // Evita que uma rajada de notícias de uma única fonte ou editoria ocupe
    // todos os destaques do dia.
    const picked=[],cats=new Set(),sources=new Set();
    for(const i of recent) {
      const c=classification(i),src=normalizeSource(i.source);
      if(cats.has(c) || sources.has(src)) continue;
      picked.push(i);cats.add(c);sources.add(src);
      if(picked.length===6)break;
    }
    for(const i of recent) {
      if(picked.length===6)break;
      if(!picked.includes(i))picked.push(i);
    }
    sec.append(sectionTitle('Destaques da edição atual','--accent',picked.length+originalHighlights.length),cardsGroup(picked,'--accent','destaques'));
    if(originalHighlights.length){
      const area=node('div','historical-section');area.append(historicalIntro(originalHighlights.length));
      const grid=node('div','hero-grid historical-highlights');originalHighlights.forEach(card=>grid.append(card));
      area.append(grid);sec.append(area);
    }
    return sec;
  }
  function footer(payload,items) {
    newFooter.replaceChildren();
    const src=[...new Set(items.map(i=>i.source).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const p=node('p','');p.append(node('strong','','Fontes de notícias efetivamente exibidas: '),document.createTextNode(src.length?src.join(', ')+'.':'nenhuma confirmada nesta coleta.'));
    const p2=node('p','');p2.append(node('strong','','Metodologia: '),document.createTextNode('Manchetes e metadados recentes provêm de feeds RSS/Atom ou agregadores, sem leitura integral das reportagens. As matérias do arquivo Claude de 16/10/2026 estão distribuídas nas editorias e identificadas por data, com os resumos originais e links da edição recebida; não foram atualizadas ou verificadas automaticamente.'));
    const p3=node('p','');p3.append(node('strong','','Restrições de acesso: '),document.createTextNode('G1, O Globo, Folha, Estadão, VEJA e The New York Times podem bloquear a leitura automatizada de matérias completas. Isso não impede necessariamente a recepção de manchetes via RSS ou agregadores. Os resumos históricos são paráfrases próprias com links para as fontes originais.'));
    const date = node('p','footer-timestamp', 'Última coleta concluída: '+dateOf(payload.last_checked_at)+'. Última coleta bem-sucedida: '+dateOf(payload.last_success_at)+'.');
    newFooter.append(p,p2,p3,date);
  }
  function render(payload) {
    if (!payload || !Array.isArray(payload.items)) throw Error('Formato de dados inválido');
    lastPayload=payload;
    // Filtros de relevância: não transformar eventos de celebridades, esportes e entretenimento em política.
    const noise = /\b(halloween|fantasias de celebridades|bbb|big brother|hor[oó]scopo|novela|receita de bolo|futebol|campeonato|show de|celebridades|reality show|moda|celebridade)\b/i;
    allItems=sortedRecent(payload.items.filter(i=>i && i.title && safeUrl(i.url) && !noise.test(i.title) && !i.archive));
    live.replaceChildren();
    const note=node('div','live-summary');
    const checked=dateOf(payload.last_checked_at);
    note.append(node('strong','', 'EDIÇÃO ATUAL · MANCHETES AUTOMÁTICAS'),node('span','', `${allItems.length} notícias · checagem: ${checked} (Brasília)`));
    if(payload.status!=='atualizado') {
      const failures=Object.entries(payload.source_health||{})
        .filter(([,v])=>v&&v.status==='erro').map(([name])=>name);
      const message=failures.length
        ? 'Coleta parcial: falha em '+failures.join(', ')+'. Outras fontes podem continuar atualizadas.'
        : 'Coleta sem novidades confirmadas. Consulte a data da última coleta válida.';
      note.append(node('span','caution',message));
    }
    const archiveTotal=[...historical.values()].reduce((n,c)=>n+c.length,0)+
      historicElection.lula.length+historicElection.flavio.length+historicElection.general.length+
      historicStreets.lula.length+historicStreets.flavio.length+originalHighlights.length;
    note.append(node('span','historical-summary',`${archiveTotal} registros históricos do Claude, separados por editoria`));
    live.append(note,highlights(allItems),renderPortals(allItems,payload.source_health||{}),electionSection(allItems));
    CATEGORIES.forEach(([cat,name,color])=>{
      if(cat==='ruas'){live.append(streetSection(allItems));return;}
      const list=allItems.filter(i=>classification(i)===cat).slice(0,15);
      const historicN=(historical.get(cat)||[]).length;
      const sec=node('section','cat');sec.dataset.cat=cat;
      sec.append(sectionTitle(name,color,list.length+historicN));
      if(list.length) sec.append(node('h3','historical-subhead','Notícias recentes'));
      sec.append(cardsGroup(list,color,cat));
      appendHistorical(sec,cat);live.append(sec);
    });
    const age=Date.now()-Date.parse(payload.last_success_at||'');
    const isRecent=Number.isFinite(age) && age>=0 && age<2.5*3600*1000;
    if(updated) updated.textContent=(isRecent?'Coletado em ':'Última coleta válida: ')+dateOf(payload.last_success_at);
    const dot=document.querySelector('.live-dot');if(dot) dot.classList.toggle('not-fresh',!isRecent);
    footer(payload,allItems);
    displaySection(active);
  }
  async function refresh() {
    try {
      const url='data/news.json?update='+Date.now();
      const result=await fetch(url,{cache:'no-store'});
      if(!result.ok) throw Error('HTTP '+result.status);
      const payload=await result.json();
      if(lastPayload && payload.last_checked_at===lastPayload.last_checked_at) return;
      render(payload);
    } catch (error) {
      const msg=error instanceof Error?error.message:String(error);
      if(!lastPayload){
        // Mesmo sem rede, apresentar o histórico do Claude dentro de cada aba.
        render({items:[],status:'indisponivel',last_checked_at:null,last_success_at:null});
        live.prepend(node('p','offline-notice','Sem conexão com a coleta automática ('+msg+'). As notícias do Claude, identificadas como arquivo, continuam disponíveis em cada categoria.'));
        if(updated)updated.textContent='Atualização não disponível';
        document.querySelector('.live-dot')?.classList.add('not-fresh');
      }
    }
  }
  displaySection('todas'); refresh();
  setInterval(refresh,5*60*1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
