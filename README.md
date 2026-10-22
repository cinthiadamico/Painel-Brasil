# Painel Brasil — visual original do Claude + coleta automática

Este projeto público reúne a **estrutura visual enviada pelo usuário em `Painel Brasil.html`** e uma edição nova construída a partir de feeds RSS/Atom. A publicação no GitHub Pages acontece no mesmo repositório, sem criar um segundo painel.

## Como usar

- Abra o site em `https://cinthiadamico.github.io/Painel-Brasil/` após a primeira execução bem-sucedida de GitHub Pages.
- As notícias atuais aparecem primeiro. Os portais ficam acessíveis no filtro **Portais**.
- A seção **Eleições** oferece quatro espaços por candidato: Fala, Proposta, Apoiador e Articulação. Campos sem registro confiável do feed ficam vazios.
- O conteúdo completo do HTML original do Claude, **datado de 16/10/2026**, aparece em **Arquivo Claude 16/10**. Ele é histórico e não deve ser confundido com notícias, pesquisas ou posições atualizadas.
- A paleta, a estrutura de cards, a tipografia e os filtros originais do Claude são preservados no HTML. O usuário pode alternar os temas claro/escuro.

## Como funcionam as atualizações

- O programa `scripts/update.py` consulta feeds das fontes no minuto 17 de cada hora **UTC**. É um agendamento de GitHub Actions; execuções podem ser atrasadas ou suspensas pela plataforma.
- O arquivo resultante é `site/data/news.json`. O navegador consulta esse arquivo a cada cinco minutos e quando a aba volta ao primeiro plano.
- A execução da rotina segue `.github/workflows/atualizar.yml`: teste de regressão, coleta, gravação e publicação via GitHub Pages.
- Para executar manualmente: repositório → **Actions → Atualizar Painel Brasil e publicar → Run workflow**.
- Para conferir erros: na mesma seção **Actions**, abra a execução mais recente. Marca verde significa sucesso; vermelha indica falha. Confira também o horário de coleta que aparece no painel.

## Ativação única do GitHub Pages

Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**. Se o salvamento de `news.json` falhar por permissão, abra **Settings → Actions → General → Workflow permissions** e verifique se a conta permite escrita no repositório (o próprio workflow declara `contents: write`).

## Fontes e integridade editorial

- Portais com acesso direto: **G1, O Globo, Folha de S.Paulo, Estadão, VEJA e The New York Times**.
- Fontes RSS adicionais: Agência Brasil, Câmara dos Deputados e Senado Federal, conforme disponibilidade.
- Quando se utiliza Google Notícias como agregador, o cartão mostra a intermediação. A presença do veículo no painel não garante que o conteúdo integral esteja acessível ao coletor.
- **O coletor não lê as reportagens completas e não substitui checagem jornalística ou confirmação de pesquisas eleitorais.** A edição recente exibe título, metadados, link e informação de que o texto integral deve ser consultado na fonte original. Não inventa citações, resultados, resumos ou propostas.
- A classificação automática não transforma toda menção a um candidato em fala, proposta ou apoio do candidato. Manifestações de terceiros não são atribuídas automaticamente a Lula ou Flávio Bolsonaro.
- Notícias irrelevantes como entretenimento e esportes são excluídas das editorias de política, sempre que identificadas. Atualizações de um mesmo projeto podem substituir versões anteriores quando a chave do evento é suficientemente específica. Casos ambíguos exigem revisão humana.
- Quando fontes falham ou a coleta não se renova, o site informa a última coleta válida; não rotula uma notícia histórica como atual.

## Arquivos do projeto

- `site/index.html`: HTML original fornecido pelo usuário com integração à edição atual.
- `site/claude-live.css` e `site/claude-live.js`: camada da edição recente, utilizando os tokens e componentes da versão Claude.
- `site/data/news.json`: dados atualizados pelas execuções.
- `scripts/update.py`: coletor RSS, classificação, deduplicação e retenção.
- `tests/test_update.py`: regressões automatizadas.
- `.github/workflows/atualizar.yml`: atualização por hora e publicação.

Para testar localmente, rode `python -m unittest discover -s tests -v`, depois `python scripts/update.py` com acesso à internet e `python -m http.server 8000 --directory site` para visualizar no navegador. Abrir o arquivo `index.html` via `file://` pode bloquear a leitura de JSON.

Este é um projeto editorial independente, sem vínculo oficial com as fontes. Resumos históricos são paráfrases com links; manchetes RSS atuais mantêm atribuição e link de origem.

## Últimos sete dias e arquivo mensal (outubro de 2026)

- O painel principal mostra **somente matérias dos últimos sete dias**, filtradas também no navegador, sem apagar o histórico.
- A aba **Arquivo mensal** apresenta pastas mensais (por exemplo, `arquivo/2026-10/`) e subpastas por dia (`arquivo/2026-10/2026-10-21/materias.json`).
- O catálogo `site/arquivo/index.json` é construído automaticamente após cada coleta e permite abrir as datas no site.
- Os itens já arquivados permanecem disponíveis depois que deixam a janela semanal. O arquivo começou a ser preservado em outubro de 2026; notícias de dias anteriores à implantação só aparecem quando há dados pré-existentes.
- O painel Claude original, datado de **16/10/2026**, permanece consultável na pasta de 16/10 como edição histórica, sem ser apresentado como notícia nova.
- O workflow executa `python scripts/update.py` e `python scripts/archive.py` a cada hora.

## Metrópoles

A aba **Metrópoles** reúne matérias recentes de Brasil, Mundo e política. Os feeds de referência são consultas RSS do Google Notícias restritas ao domínio `metropoles.com`; os cards identificam a passagem pelo agregador e preservam os links. O dia mostrado segue o horário de Brasília. Quando não há publicação datada do dia atual, a aba mostra as últimas disponíveis e informa a diferença.


## Atualização do painel original do Claude (edição de 21/10/2026)

A edição enviada em `Painel Brasil (1).html` foi incorporada ao repositório como
`imports/claude/2026-10-21.html`. São **667 cards de notícias e 22 destaques**.
O importador `scripts/import_claude.py` extrai e preserva os **689 registros**
em `site/arquivo/2026-10/2026-10-21/claude.json`, com 133 posições de
Lula e 133 de Flávio Bolsonaro no arquivo eleitoral.

- **Página principal**: exibe o RSS da última semana e uma seleção de matérias
  recentes da edição do Claude sob as editorias correspondentes. Os cards
  importados identificam a data da edição quando a data da publicação individual
  não foi informada.
- **Arquivo mensal**: apresenta a edição completa do Claude por
  `?aba=arquivo&data=2026-10-21`, incluindo títulos, resumos e links.
- **Transparência**: o conteúdo do Claude é uma importação manual, não uma
  coleta automática nem uma checagem independente de fatos. Alterações futuras
  no artifact do Claude exigem nova exportação/importação do HTML.
- **Convivência**: o histórico do Claude de 16/10 permanece consultável no
  arquivo do dia 16; a coleta RSS dos portais continua horária.

O workflow executa primeiro a coleta RSS, depois a importação das edições
Claude já enviadas ao repositório e, por último, atualiza o índice mensal.
