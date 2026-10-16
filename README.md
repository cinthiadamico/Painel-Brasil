# Painel Brasil — edição independente com atualização por hora

Site estático com identidade editorial em Source Serif 4, IBM Plex Sans e IBM Plex Mono, paletas claro/escuro, filtros por editoria, seis portais selecionados e área **Eleições 2026: Lula × Flávio Bolsonaro** (quatro posições por lado).

## O que já está incluído

- **site/** contém o painel pronto para GitHub Pages, sem servidor de aplicação nem chave de API.
- **scripts/update.py** busca manchetes de RSS/Atom, guarda links, datas e atribuição, classifica editorias, reúne registros parecidos e impede que o arquivo inicial seja tratado como notícia recente.
- **.github/workflows/atualizar.yml** agenda a coleta no minuto **17 de cada hora (UTC)**, grava `site/data/news.json` e publica a edição no **GitHub Pages**.
- O navegador verifica se existe um JSON mais recente **a cada cinco minutos** e quando a aba volta a ficar visível. A **coleta das fontes é horária**, não a cada cinco minutos.
- **Arquivo inicial de 16/10/2026**: apenas para demonstrar o layout e não deve ser confundido com notícias novas. Ele será substituído quando a coleta encontrar manchetes.

## Publicar — GitHub Pages

1. No GitHub, crie um repositório chamado `painel-brasil` (público para usar GitHub Pages no plano gratuito), enviando **todo o conteúdo desta pasta**, inclusive `.github/workflows/atualizar.yml`.
2. Use a branch padrão `main` (o workflow aponta para `main`).
3. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.
4. Em **Settings → Actions → General → Workflow permissions**, habilite **Read and write permissions**, caso o workflow não consiga salvar o JSON. As permissões `pages: write` e `id-token: write` estão declaradas no workflow.
5. Em **Actions**, abra **Atualizar Painel Brasil e publicar** e clique **Run workflow** para a primeira execução. As próximas estão agendadas a cada hora (o GitHub pode atrasar ou pular algumas execuções).
6. Após uma publicação bem-sucedida, o endereço em geral será `https://SEU-USUARIO.github.io/painel-brasil/`. **Este endereço só existirá depois que o repositório for criado e Pages for ativado.**

Se o GitHub não estiver disponível, rode `python -m http.server 8000 --directory site` e abra `http://localhost:8000`. Para testar a coleta, execute `python scripts/update.py` antes. A execução local exige conexão com a internet.

## Origem e limites editoriais

- O painel inclui links de **G1, O Globo, Folha de S.Paulo, Estadão, VEJA e The New York Times** na seção Portais.
- Além desses veículos, usa RSS de **Agência Brasil**, **Agência Câmara** e **Agência Senado**.
- Quando um portal bloqueia requisições diretas, uma busca RSS pelo **Google Notícias** pode oferecer manchetes, com link de redirecionamento via Google. Esses cartões mostram explicitamente **“via Google Notícias”**. A presença do portal nos links diretos não significa que suas matérias tenham sido obtidas na coleta.
- Os horários são extraídos dos feeds. Matérias sem data são descartadas; publicações antigas são limitadas a aproximadamente 3,5 dias (até 7 dias para preencher campos eleitorais).
- O programa não acessa o corpo integral dos artigos nem faz verificação factual. As sinopses são formulações genéricas originais **a partir do título**, não interpretações do texto completo.
- Na seção eleitoral, o sistema seleciona no máximo uma matéria recente por modalidade (**Fala, Proposta, Apoiador, Articulação**) de cada candidato. Se não houver notícia classificada, aparece uma posição vazia, sem inventar declaração nem forçar equilíbrio informativo.
- A detecção de notícias sobre o mesmo evento usa semelhança de títulos; **não substitui uma revisão editorial humana sobre mudanças em decisões judiciais, andamento de PECs, pesquisas eleitorais ou informações contraditórias**.
- Sites e disponibilidade dos feeds podem mudar sem aviso; o painel exibe o último sucesso e sinaliza desatualização.

## Testes

```bash
python -m unittest discover -s tests -v
```

## Privacidade, custos e licença

Não há cookies de rastreamento do projeto, conta de usuário ou banco de dados. É um agregador informativo não afiliado às fontes. GitHub Pages e Actions podem ter limites de uso/custos dependendo da conta e do repositório; verifique sua elegibilidade e consumo no GitHub. As notícias continuam pertencendo aos veículos de origem; só são mantidos metadados, manchetes, notas automáticas genéricas e links.

**Prévia offline:** abra `site/index.html` diretamente no navegador. Se o navegador bloquear a leitura de JSON por `file://`, a interface exibe o arquivo inicial de 16/10/2026 por meio de `site/seed.js`. Essa cópia local não se atualiza sem execução do workflow.
