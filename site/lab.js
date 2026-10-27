/* Laboratório editorial: consome os mesmos JSONs publicados, sem modificar main. */
(function () {
  'use strict';
  var state = {items: [], ai: [], editions: [], view: 'geral', search: '', sort: 'date', limit: 12};
  var categories = {
    geral: {title: 'Em destaque', subtitle: 'Panorama das editorias', matches: null},
    eleicoes: {title: 'Eleições', subtitle: 'Processo eleitoral e candidatos', matches: ['Eleições']},
    politica: {title: 'Política e governo', subtitle: 'Poder Executivo e política', matches: ['Política', 'Governo federal']},
    economia: {title: 'Economia e dívida pública', subtitle: 'Indicadores e orçamento', matches: ['Economia', 'Endividamento']},
    congresso: {title: 'Congresso Nacional', subtitle: 'Câmara e Senado', matches: ['Câmara e Senado']},
    justica: {title: 'STF e Justiça', subtitle: 'Tribunais e decisões', matches: ['STF e Justiça']},
    social: {title: 'Brasil', subtitle: 'Saúde, educação, segurança', matches: ['Saúde', 'Educação', 'Segurança', 'Brasil nas ruas']},
    mundo: {title: 'Mundo', subtitle: 'Internacional e geopolítica', matches: ['Internacional']},
    arquivo: {title: 'Arquivo de edições', subtitle: 'Memória e histórico não verificado', matches: []}
  };
  function el(tag, name, content) {
    var result = document.createElement(tag);
    if (name) result.className = name;
    if (content != null) result.textContent = String(content);
    return result;
  }
  function get(id) { return document.getElementById(id); }
  function safeLink(raw) {
    try {
      var u = new URL(String(raw));
      return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
    } catch (e) { return null; }
  }
  function date(raw, time) {
    var value = Date.parse(raw || '');
    if (!Number.isFinite(value)) return 'Data não informada';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
      year: 'numeric', ...(time ? {hour: '2-digit', minute: '2-digit'} : {})
    }).format(new Date(value));
  }
  function appendLink(parent, label, link) {
    var url = safeLink(link);
    if (!url) return;
    var anchor = el('a', '', label);
    anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
    parent.append(anchor);
  }
  function notice(text) { return el('p', 'notice', text); }
  function card(item, historic) {
    var box = el('article', 'story');
    var head = el('div', 'storyhead');
    head.append(el('span', 'tag' + (historic ? ' archive-tag' : ''), historic ? 'Arquivo Claude' : item.category || 'Notícia'));
    head.append(el('span', 'when', historic ?
      'Edição ' + (item.edition_date || 'não informada') +
      (item.published_at ? ' · Publicação ' + date(item.published_at, false) : ' · Sem data confirmada') :
      date(item.published_at, true)));
    box.append(head);
    var h = el('h4');
    if (safeLink(item.url)) appendLink(h, item.title || 'Notícia', item.url);
    else h.textContent = item.title || 'Notícia';
    box.append(h);
    if (historic) box.append(el('p', 'summary', item.summary || 'Importação sem resumo.'));
    var foot = el('div', 'storyfooter');
    foot.append(el('span', '', item.source || 'Fonte não informada'));
    appendLink(foot, 'Abrir fonte ↗', item.url);
    box.append(foot);
    return box;
  }
  function filtered() {
    var rule = categories[state.view].matches;
    var q = state.search.toLocaleLowerCase('pt-BR');
    var data = state.items.filter(function (it) {
      return (rule === null || rule.includes(it.category)) &&
        (!q || [it.title, it.source, it.category].join(' ').toLocaleLowerCase('pt-BR').includes(q));
    });
    data.sort(state.sort === 'source'
      ? function (a, b) { return (a.source || '').localeCompare(b.source || '', 'pt-BR'); }
      : function (a, b) { return Date.parse(b.published_at || 0) - Date.parse(a.published_at || 0); });
    return data;
  }
  function renderNews() {
    var area = get('results');
    area.replaceChildren();
    if (state.view === 'arquivo') {
      get('more').hidden = true;
      area.append(notice('Selecione uma edição no Arquivo Claude abaixo. Cada edição tem sua própria busca, para não misturar registros históricos e notícias atuais.'));
      get('resultsCount').textContent = '';
      return;
    }
    var data = filtered();
    get('resultsCount').textContent = data.length + ' notícias';
    if (!data.length) area.append(notice('Nenhuma notícia encontrada neste filtro ou no conjunto atual.'));
    data.slice(0, state.limit).forEach(function (it) { area.append(card(it, false)); });
    get('more').hidden = state.limit >= data.length;
  }
  function renderAI() {
    var box = get('ai'); box.replaceChildren();
    if (!state.ai.length) {
      box.append(notice('Geração pela API ainda não ativada. A coleta RSS continua independente.'));
      return;
    }
    state.ai.slice(0, 5).forEach(function (item) {
      var row = el('div', 'ai-entry');
      row.append(el('strong', '', item.question));
      row.append(el('p', '', item.title));
      row.append(el('small', '', item.source + ' · ' + date(item.published_at, false)));
      var foot = el('div'); appendLink(foot, 'Conferir na fonte ↗', item.url);
      row.append(foot); box.append(row);
    });
  }
  function archivePath(raw) {
    var s = String(raw || '');
    return /^arquivo\/[0-9-]+\/[0-9-]+\/(claude|artifacts|materias)\.json$/.test(s) ? './' + s : null;
  }
  async function json(path) {
    var response = await fetch(path, {cache: 'no-store'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }
  function editionsFrom(claude, artifacts, daily) {
    var list = [];
    (claude.editions || []).forEach(function (it) {
      list.push({day: it.edition_date, kind: 'Edição HTML do Claude',
                 count: it.count, path: it.path, historic: true});
    });
    (artifacts.editions || []).forEach(function (it) {
      list.push({day: it.edition_date, kind: 'Claude Artifact JSON',
                 count: it.count, path: it.path, historic: true});
    });
    (daily.months || []).forEach(function (month) {
      (month.days || []).forEach(function (it) {
        list.push({day: it.date, kind: 'Matérias RSS arquivadas',
                   count: it.count, path: it.path, historic: false});
      });
    });
    list.sort(function (a, b) { return b.day.localeCompare(a.day) || a.kind.localeCompare(b.kind); });
    return list;
  }
  async function openEdition(target, edition) {
    var body = el('div', 'archive-list');
    target.replaceChildren(body);
    body.append(notice('Consultando arquivo…'));
    try {
      var data = await json(archivePath(edition.path));
      var items = Array.isArray(data.items) ? data.items : [];
      var grid = el('div', 'news-grid');
      var amount = 15;
      var searchBox = el('div', 'archive-search');
      var searchLabel = el('label', '', 'Pesquisar nesta edição');
      var searchInput = el('input');
      searchInput.type = 'search';
      searchInput.placeholder = 'Assunto, veículo, candidato ou palavra-chave';
      searchInput.setAttribute('aria-label', 'Pesquisar registros da edição de ' + edition.day);
      searchLabel.append(searchInput);
      searchBox.append(searchLabel);
      var count = el('p', 'archive-sub');
      function render() {
        var query = searchInput.value.trim().toLocaleLowerCase('pt-BR');
        var filteredItems = query ? items.filter(function (it) {
          return [it.title, it.source, it.summary, it.category, it.candidate]
            .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(query);
        }) : items;
        count.textContent = filteredItems.length + ' de ' + items.length + ' registros';
        grid.replaceChildren();
        if (!filteredItems.length) {
          grid.append(notice('Nenhum registro encontrado nesta edição.'));
        }
        filteredItems.slice(0, amount).forEach(function (it) {
          grid.append(card(it, edition.historic));
        });
        more.hidden = amount >= filteredItems.length;
      }
      searchInput.addEventListener('input', function () { amount = 15; render(); });
      var more = el('button', 'archive-more', 'Mostrar mais do arquivo');
      more.type = 'button';
      more.addEventListener('click', function () { amount += 15; render(); });
      body.replaceChildren(el('p', 'archive-sub',
        edition.historic ?
        'Edição histórica importada do Claude; texto não verificado de modo independente.' :
        'Manchetes RSS preservadas na data da coleta, sem garantia de verificação.'), 
        searchBox, count, grid, more);
      render();
    } catch (err) {
      body.replaceChildren(notice('Não foi possível abrir este arquivo. Verifique se a importação já foi executada.'));
    }
  }
  function renderArchive() {
    var box = get('archive'); box.replaceChildren();
    if (!state.editions.length) { box.append(notice('Ainda não há edições arquivadas.')); return; }
    state.editions.slice(0, 45).forEach(function (edition) {
      var node = el('div', 'edition');
      var button = el('button', 'edition-button');
      button.type = 'button'; button.setAttribute('aria-expanded', 'false');
      button.append(el('span', '', edition.day + ' · ' + edition.kind));
      button.append(el('small', '', edition.count + ' registros ▾'));
      var content = el('div'); content.hidden = true;
      button.addEventListener('click', function () {
        var expand = content.hidden;
        document.querySelectorAll('.edition .archive-list').forEach(function (x) {
          if (x.parentElement !== content) x.parentElement.hidden = true;
        });
        content.hidden = !expand;
        button.setAttribute('aria-expanded', String(expand));
        if (expand && !content.dataset.loaded) {
          content.dataset.loaded = '1'; openEdition(content, edition);
        }
      });
      node.append(button, content); box.append(node);
    });
  }
  function setView(view, updateURL) {
    if (!categories[view]) view = 'geral';
    state.view = view; state.limit = 12;
    document.querySelectorAll('[data-view]').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.view === view);
      tab.setAttribute('aria-pressed', String(tab.dataset.view === view));
    });
    get('archiveSection').hidden = view !== 'arquivo';
    get('search').disabled = view === 'arquivo';
    get('search').placeholder = view === 'arquivo'
      ? 'Use a pesquisa dentro de cada edição histórica'
      : 'Buscar por assunto, veículo ou palavra-chave';
    get('sort').disabled = view === 'arquivo';
    get('resultsKicker').textContent = categories[view].subtitle;
    get('resultsTitle').textContent = categories[view].title;
    get('overline').textContent = view === 'arquivo' ? 'Memória de edições' : 'Atualizações por fonte';
    get('heading').textContent = view === 'arquivo' ?
      'História preservada, com datas e origens.' :
      view === 'geral' ? 'Notícias do Brasil, com contexto e origem clara.' : categories[view].title;
    get('introText').textContent = view === 'arquivo'
      ? 'Consulte o histórico RSS e os conteúdos importados do Claude, sem confundi-los com notícias atuais.'
      : 'Manchetes recentes das fontes monitoradas. Análises de IA são identificadas e não substituem a leitura original.';
    if (updateURL) {
      var url = new URL(location.href); url.searchParams.set('aba', view);
      history.replaceState(null, '', url);
    }
    renderNews();
    if (view === 'arquivo') renderArchive();
  }
  document.querySelectorAll('[data-view]').forEach(function (button) {
    button.addEventListener('click', function () { setView(button.dataset.view, true); });
  });
  get('search').addEventListener('input', function (event) {
    state.search = event.target.value.trim(); state.limit = 12; renderNews();
  });
  get('sort').addEventListener('change', function (event) {
    state.sort = event.target.value; renderNews();
  });
  get('more').addEventListener('click', function () { state.limit += 12; renderNews(); });
  (async function boot() {
    var result = await Promise.allSettled([
      json('./data/news.json'),
      json('./data/claude-insights.json'),
      json('./arquivo/claude-index.json'),
      json('./arquivo/artifacts-index.json'),
      json('./arquivo/index.json')
    ]);
    if (result[0].status === 'fulfilled') {
      var feed = result[0].value;
      state.items = Array.isArray(feed.items) ? feed.items : [];
      get('itemCount').textContent = state.items.length;
      var last = Date.parse(feed.last_success_at || '');
      var age = Date.now() - last;
      var fresh = Number.isFinite(age) && age >= 0 && age <= 3 * 60 * 60 * 1000;
      get('status').textContent = 'Última coleta: ' + date(feed.last_success_at, true) +
        (fresh ? '' : ' · conferir atualização');
      get('signal').className = 'signal ' + (fresh ? 'fresh' : 'stale');
    } else {
      get('status').textContent = 'Coleta RSS indisponível';
      get('itemCount').textContent = '0';
      get('signal').className = 'signal stale';
    }
    if (result[1].status === 'fulfilled' &&
        Array.isArray(result[1].value.entries) &&
        result[1].value.status === 'generated') {
      var generatedAt = Date.parse(result[1].value.generated_at || '');
      var elapsed = Date.now() - generatedAt;
      // Conteúdo gerado não deve parecer atual quando a execução envelhece.
      if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 72 * 60 * 60 * 1000) {
        state.ai = result[1].value.entries.filter(function (it) { return !!safeLink(it.url); });
      }
    }
    function valid(index) { return result[index].status === 'fulfilled' ? result[index].value : {}; }
    state.editions = editionsFrom(valid(2), valid(3), valid(4));
    renderAI();
    var requested = new URLSearchParams(location.search).get('aba') || 'geral';
    setView(requested, false);
  })();
})();
