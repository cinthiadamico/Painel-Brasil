# Painel Brasil — laboratório Claude + RSS

## Situação e isolamento

Este experimento mora na branch teste/reformulacao-claude-api.
A rotina de testes é automática a cada push relevante na branch de teste.
A coleta RSS de produção continua independente; a geração Claude exige
secret e gatilho intencional para rodar na branch de teste.
Um agendamento diário para a integração editorial só ocorre após aprovação
formal e merge do workflow na branch padrão.
A branch main, o index.html original e o workflow de publicação original não são alterados.
A nova interface é site/lab.html. Ela não é publicada automaticamente no GitHub Pages.

A arquitetura mantém quatro origens separadas:

1. site/data/news.json: manchetes e fontes RSS, atualizadas por scripts/update.py.
2. site/arquivo/**/claude.json: edições HTML de Claude já importadas pelo
   scripts/import_claude.py (a edição de 21/10/2026 já existe).
3. site/arquivo/**/artifacts.json: exports JSON normalizados de Claude Artifacts,
   importados pelo novo scripts/import_artifacts.py. O índice fica
   em site/arquivo/artifacts-index.json.
4. site/data/claude-insights.json: perguntas editoriais sugeridas pela API,
   sempre vinculadas a id, fonte, título, data e URL de um item RSS.

**Nenhuma fonte é verificada por IA.** Os títulos RSS não contêm reportagens
completas. Perguntas geradas não são matérias, falas atribuídas, pesquisas ou
resultados oficiais. O usuário deve consultar o artigo original.

## Testar sem custos nem alteração do portal

No repositório, selecionar a branch de teste e clonar/baixar os arquivos.
Executar, a partir da raiz:

    python -m unittest discover -s tests -v
    python scripts/claude_enrich.py --dry-run
    python -m http.server 8000 --directory site

Abrir http://localhost:8000/lab.html para ver a nova navegação.
A página lê os JSONs locais. Sem API configurada, a seção IA informa que está
desativada. O JSON de exemplo é um estado desativado, não conteúdo inventado.
Abrir HTML diretamente via file:// pode impedir o fetch de JSON.

O workflow testar-reformulacao.yml valida Python e JavaScript sem chave API.
Também executa `tests/smoke_lab.mjs` em Chrome headless com os dados reais da
branch: consulta manchetes, filtra Eleições, testa busca, abre a edição Claude
de 21/10/2026 com 689 registros, pesquisa seu conteúdo e verifica telas de
390 px sem rolagem horizontal. O teste captura três imagens em
`qa/screenshots/`: `desktop.png`, `arquivo.png` e `celular.png`.
O workflow anexa essas imagens como artifact `painel-brasil-capturas`.

O campo de busca principal filtra apenas notícias RSS recentes. No Arquivo
Claude, cada edição aberta tem uma pesquisa própria, sem misturar dados
históricos e notícias atuais. Para edições com data desconhecida, a interface
indica claramente `Sem data confirmada`.
A cada execução aprovada na branch de teste, produz também o artifact
`painel-brasil-preview` para download na aba Actions (retenção de 14 dias).
Descompacte-o e execute `python -m http.server 8000` a partir da pasta
extraída, abrindo `/lab.html` no navegador. Este pacote NÃO é um deploy;
os dados refletem o commit que originou aquela execução.

## Importar HTML e Artifacts

HTML original do Claude: imports/claude/AAAA-MM-DD.html
Gerador existente: python scripts/import_claude.py

Para um Artifact em outro formato, **exportar os dados para JSON estruturado**,
seguindo imports/claude_artifacts/EXEMPLO.json.txt.
Criar imports/claude_artifacts/AAAA-MM-DD.json, contendo items com
title, url e source (obrigatórios). summary, category e published_at opcionais.
Se a data individual não estiver confirmada, deixar published_at em null.
Depois executar:

    python scripts/import_artifacts.py

Cada registro precisa de link HTTPS e veículo identificado. Não copie
conteúdo protegido integralmente nem informações pessoais para exports públicos.
O script não se conecta à conta Claude.ai, conversas nem Artifacts privados
automaticamente. A importação exige um arquivo fornecido pela responsável.

## Ativar a API de modo controlado

1. Criar chave própria em https://platform.claude.com/ e verificar os limites
   de gastos e faturamento. Não enviar chaves no chat ou incluir em commits.
2. No GitHub: Settings > Secrets and variables > Actions >
   New repository secret. Nome exato: ANTHROPIC_API_KEY.
3. Para testar na branch sem fazer merge, criar um arquivo
   experimentos/executar-claude.txt na branch teste/reformulacao-claude-api,
   com um identificador de execução (ex.: data da revisão), e fazer commit
   nessa branch. Esse push explícito aciona o workflow Claude experimental
   sem etapa de deploy. Para executar novamente, alterar o conteúdo do
   mesmo arquivo e fazer outro commit. Conferir o log e o JSON **na branch**.
   A execução manual via botão Run workflow pode não aparecer na interface
   antes de o workflow existir na branch default, conforme regras do GitHub.
4. A API usa POST /v1/messages com anthropic-version 2026-10-21,
   modelo claude-haiku-5-5 por padrão, até 10 manchetes nas últimas 48 h,
   máximo 1300 tokens de saída por execução. Isso LIMITA o volume por chamada,
   mas não representa teto monetário total; configure também limites de conta.
5. A rotina só entra em execução diária agendada após aprovação e merge
   do workflow na branch default. Scheduled workflows do GitHub Actions
   só executam na branch default. A atualização da camada Claude não
   tem etapa de publicação. Em caso de falha na API ou ausência de chave,
   nenhum texto especulativo substitui o JSON anterior.

## Critérios para ativar a reformulação em produção

- Os testes existentes e novos devem passar.
- Revisão humana do conteúdo importado e das perguntas geradas.
- Identificação e datas corretas em todos os cards.
- Sem exposição de chaves, sem conexão direta do navegador à API.
- Revisão de acessibilidade, telas móveis, fontes e fontes indisponíveis.
- Só então substituir a página inicial original por uma versão aprovada da lab.

## Limites desta etapa

O protótipo de interface não substitui o index.html publicado e não permite
sincronizar diretamente Artifacts privados do Claude.ai. A integração da API
só será testável com credenciais e créditos fornecidos pela proprietária.
As avaliações automáticas não são garantia de precisão jornalística.

## Erro HTTP 400 por workspace não selecionado (27/10/2026)

A API informou `invalid_request_error` associado a workspace. Chaves
não limitadas a um único workspace exigem o header `anthropic-workspace-id`.
Corrigimos o módulo `scripts/claude_enrich.py` para reconhecer a variável
`ANTHROPIC_WORKSPACE_ID` e passá-la com a requisição quando configurada.

1. Abra https://platform.claude.com/settings/workspaces e copie a coluna ID
   do workspace acessível pela sua chave (identificador `wrkspc_...`).
2. Abra GitHub > Painel-Brasil > Settings > Secrets and variables > Actions >
   **Variables** > **New repository variable** e cadastre:
   Name = `ANTHROPIC_WORKSPACE_ID`; Value = o ID que você copiou.
   É uma variável de configuração, NÃO sua chave ou senha.
3. Mantenha `ANTHROPIC_API_KEY` em **Secrets**, sem copiá-la para Variables.
4. A execução da branch de teste poderá ser disparada alterando
   `experimentos/executar-claude.txt`.
5. Alternativa: gerar uma chave vinculada a um único workspace no Console
   e substituir o secret `ANTHROPIC_API_KEY`, sem definir a variável.
6. Quando a API retorna erro, o workflow acusa falha, mantendo a
   camada editorial anterior. Os logs exibem somente HTTP e categoria, nunca
   o valor da chave ou o texto livre retornado pelo servidor.

Documentação: https://platform.claude.com/docs/en/manage-claude/authentication
