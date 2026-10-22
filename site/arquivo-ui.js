/* Navegador do arquivo mensal e diario do Painel Brasil.
   O material original do Claude (16/10/2026) so aparece na area de arquivo. */
(() => {
  'use strict';
  let panel=null, catalogLoaded=false, catalogue=null, context=null;
  let currentDate='';
  const $el=(tag,cls,text)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text!==undefined)e.textContent=String(text);
    return e;
  };
  const showDate=(iso)=>{
    const [y,m,d]=iso.split('-');
    return d+'/'+m+'/'+y;
  };
  function monthLabel(month){
    try {
      const d=new Date(month+'-01T12:00:00Z');
      return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(d);
    }catch{return month;}
  }
  function originalArchive(target, ctx) {
    const wrapper=$el('div','archive-claude');
    const sourceLink=$el('a','archive-claude-link','Abrir o painel original no Claude ↗');
    sourceLink.href='https://claude.ai/artifact/Vx6RgYBDQxKwJ2mnibkcxz';
    sourceLink.target='_blank';
    sourceLink.rel='noopener noreferrer';
    wrapper.append(
      $el('p','small-note','Sincronização com Claude: manual. Este arquivo foi importado em 16/10/2026. Mudanças feitas no artifact não são copiadas automaticamente para o Painel Brasil.'),
      sourceLink
    );
    wrapper.append(
      $el('h3','archive-title','Painel original do Claude · 16/10/2026'),
      $el('p','small-note','Edição histórica recebida. O conteúdo e as pesquisas não são atualizados nem revalidados automaticamente. Os links externos permanecem disponíveis.')
    );
    function group(title,cards){
      if(!cards||!cards.length)return;
      const head=$el('h4','archive-group-title',title);
      const grid=$el('div','card-grid');
      cards.forEach(c=>grid.append(c));wrapper.append(head,grid);
    }
    group('Destaques da edição original',ctx.originalHighlights);
    group('Eleições 2026 · Lula',ctx.historicElection.lula);
    group('Eleições 2026 · Flávio Bolsonaro',ctx.historicElection.flavio);
    group('Outras matérias eleitorais',[...(ctx.historical.get('eleicoes')||[]),...ctx.historicElection.general]);
    group('Brasil nas ruas · Lula',ctx.historicStreets.lula);
    group('Brasil nas ruas · Flávio Bolsonaro',ctx.historicStreets.flavio);
    for(const [key,name] of ctx.CATEGORIES){
      const cards=ctx.historical.get(key)||[];
      if(cards.length)group(name,cards);
    }
    const other=[...ctx.historical.entries()].filter(([key])=>!ctx.CATEGORIES.some(c=>c[0]===key)&&key!=='eleicoes');
    other.forEach(([key,cards])=>group(key,cards));
    if(ctx.originalRace){
      const details=$el('details','historical-context');
      details.append($el('summary','','Pesquisas eleitorais registradas em 16/10/2026'),
        $el('p','small-note','Resultados históricos. Não são estimativas ou pesquisas do dia atual.'),
        ctx.originalRace);
      wrapper.append(details);
    }
    if(ctx.originalElectionNote)wrapper.append(ctx.originalElectionNote);
    target.append(wrapper);
  }
  async function loadDay(date, url, claudePath){
    if(!panel||!context)return;
    const area=panel.querySelector('#arquivo-materias');
    if(!area)return;
    currentDate=date;
    panel.querySelectorAll('.archive-day').forEach(btn=>
      btn.setAttribute('aria-pressed',String(btn.dataset.date===date)));
    area.replaceChildren($el('p','archive-loading','Carregando matérias de '+showDate(date)+'...'));
    const path=/^arquivo\/20\d{2}-\d{2}\/20\d{2}-\d{2}-\d{2}\/materias\.json$/;
    const sourcePath=/^arquivo\/20\d{2}-\d{2}\/20\d{2}-\d{2}-\d{2}\/claude\.json$/;
    let entries=[],claudeEntries=[],failure=false;
    const files=[];
    if(path.test(url)){
      files.push(fetch(url+'?v='+Date.now(),{cache:'no-store'})
        .then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();})
        .then(data=>{if(data.date===date&&Array.isArray(data.items))entries=data.items;})
        .catch(()=>{failure=true;}));
    }
    if(claudePath&&sourcePath.test(claudePath)){
      files.push(fetch(claudePath+'?v='+Date.now(),{cache:'no-store'})
        .then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();})
        .then(data=>{if(data.edition_date===date&&Array.isArray(data.items))claudeEntries=data.items;})
        .catch(()=>{failure=true;}));
    }
    await Promise.all(files);
    if(currentDate!==date)return;
    area.replaceChildren(
      $el('h3','archive-title','Matérias de '+showDate(date)),
      $el('p','small-note',entries.length+' matérias coletadas automaticamente; '+
        claudeEntries.length+' registros da edição do Claude. A edição Claude preserva títulos e resumos fornecidos, não verificados de forma independente.')
    );
    const byCategory=new Map();
    entries.forEach(item=>{
      if(!item||!item.title||!item.url)return;
      const category=item.category||'Outras notícias';
      if(!byCategory.has(category))byCategory.set(category,[]);
      byCategory.get(category).push(item);
    });
    for(const [category,news] of byCategory){
      area.append($el('h4','archive-group-title',category+' · portais RSS'));
      const grid=$el('div','card-grid');
      news.sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at)));
      news.forEach(item=>grid.append(context.createCard(item,{category:'arquivo',color:'--accent'})));
      area.append(grid);
    }
    if(claudeEntries.length){
      const editorial=$el('div','archive-claude');
      editorial.append(
        $el('h3','archive-title','Edição do Claude · '+showDate(date)),
        $el('p','small-note','Arquivo enviado pelo usuário. O conteúdo não foi verificado independentemente; a data da edição não indica necessariamente a data de publicação de cada matéria. Clique nas editorias abaixo.')
      );
      const categories=new Map();
      for(const item of claudeEntries){
        if(!item||!item.title||!item.url)continue;
        let key=item.section_id||item.category||'Outros';
        if(key==='eleicoes')key+='-'+(item.candidate||'geral');
        if(!categories.has(key))categories.set(key,[]);
        categories.get(key).push(item);
      }
      const names={
        'destaques':'Destaques','eleicoes-lula':'Eleições · Lula',
        'eleicoes-flavio':'Eleições · Flávio Bolsonaro',
        'eleicoes-geral':'Eleições · outros',
        'ruas':'Brasil nas ruas','politica':'Política & Governo',
        'economia':'Economia','justica':'Justiça & STF',
        'camara':'Câmara dos Deputados','senado':'Senado',
        'intl':'Internacional & Geopolítica','saude':'Saúde',
        'edu':'Educação','seg':'Segurança'
      };
      for(const [category,news] of categories){
        const detail=$el('details','archive-month archive-editoria');
        detail.append($el('summary','', (names[category]||category)+' · '+news.length+' matérias'));
        detail.addEventListener('toggle',()=>{
          if(!detail.open||detail.dataset.rendered==='true')return;
          detail.dataset.rendered='true';
          const grid=$el('div','card-grid');
          news.forEach(item=>grid.append(context.createCard(item,{category:'arquivo',color:'--accent'})));
          detail.append(grid);
        });
        editorial.append(detail);
      }
      area.append(editorial);
    }
    if(date==='2026-10-16')originalArchive(area,context);
    if(!entries.length&&!claudeEntries.length&&date!=='2026-10-16'){
      area.append($el('p',failure?'archive-error':'empty-state',
        failure?'Uma ou mais fontes do arquivo não puderam ser carregadas.':'Nenhuma matéria preservada nesta data.'));
    }
  }
  async function loadCatalogue() {
    if(!panel)return;
    const box=panel.querySelector('#arquivo-meses');
    if(!box)return;
    if(!catalogLoaded)box.replaceChildren($el('p','archive-loading','Buscando meses disponíveis...'));
    try{
      const res=await fetch('arquivo/index.json?v='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw Error('HTTP '+res.status);
      const data=await res.json();
      if(!Array.isArray(data.months))throw Error('Formato inválido');
      const fingerprint=JSON.stringify(data.months);
      if(catalogue===fingerprint)return;
      catalogue=fingerprint;catalogLoaded=true;box.replaceChildren();
      for(const month of data.months){
        if(!Array.isArray(month.days)||!month.days.length)continue;
        const wrap=$el('details','archive-month');
        if(month.month===data.months[0].month)wrap.open=true;
        wrap.append($el('summary','','📁 '+monthLabel(month.month)+' · '+month.days.length+' dias'));
        const row=$el('div','archive-days');
        month.days.forEach(day=>{
          if(!/^\d{4}-\d{2}-\d{2}$/.test(day.date))return;
          const btn=$el('button','archive-day',
            showDate(day.date)+' · '+day.count+' RSS'+(day.claude_count?' + '+day.claude_count+' Claude':day.claude_original?' + Claude':''));
          btn.type='button';btn.dataset.date=day.date;
          btn.setAttribute('aria-pressed',String(day.date===currentDate));
          btn.addEventListener('click',()=>loadDay(day.date,day.path,day.claude_path));
          row.append(btn);
        });
        wrap.append(row);box.append(wrap);
      }
      if(!box.children.length)box.append($el('p','empty-state','O arquivo mensal ainda não tem matérias.'));
      if(!currentDate){
        let requested=null;
        try {requested=new URLSearchParams(location.search).get('data');}catch(_){}
        const selected=data.months.flatMap(month=>month.days).find(day=>day.date===requested);
        if(selected)loadDay(selected.date,selected.path,selected.claude_path);
      }
    }catch(error){
      if(!catalogLoaded)box.replaceChildren($el('p','archive-error','O índice mensal ainda não está disponível. A coleta horária criará as pastas automaticamente.'));
    }
  }
  window.PainelBrasilArquivo = {
    makeSection(ctx){
      context=ctx;
      if(panel){loadCatalogue();return panel;}
      panel=$el('section','cat archive-section');
      panel.dataset.cat='arquivo';panel.id='arquivo-mensal';
      const heading=$el('div','cat-head');
      const dot=$el('span','cat-dot');dot.style.background='var(--accent)';
      heading.append(dot,$el('h2','','Arquivo mensal'),$el('span','cat-count','Por mês e por dia'));
      panel.append(heading,
        $el('p','small-note','Consulte o histórico em pastas por mês e subpastas por data. A página principal mostra somente as matérias dos últimos sete dias.'),
        $el('div','archive-month-list'));
      panel.lastElementChild.id='arquivo-meses';
      const viewer=$el('div','archive-viewer');viewer.id='arquivo-materias';
      viewer.append($el('p','small-note','Escolha um mês e uma data para consultar as matérias arquivadas.'));
      panel.append(viewer);
      loadCatalogue();
      return panel;
    },
    refresh:loadCatalogue
  };
})();
