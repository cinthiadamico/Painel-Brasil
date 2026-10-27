# Painel Brasil — candidato de publicação

**Status: PR para revisão. NÃO PUBLICADO.**

Criado em 27/10/2026 a partir da main atual, sem incorporar nem substituir
os arquivos de coleta periódica, os arquivos RSS de arquivo ou edições históricas.
O PR #6 anterior tinha conflitos com a main porque esta se atualiza a cada hora.

## Entrega proposta

- site/index.html: nova página inicial, layout editorial elegante e responsivo.
- site/lab.css e site/lab.js: apresentação e renderização do painel novo.
- site/versao-anterior.html: preserva a homepage antiga para consulta/rollback.
- site/lab.html: conserva a versão experimental, isolada.
- site/data/news.json e site/arquivo/**: mantidos diretamente da main, não alterados pelo PR.
- site/data/claude-insights.json: perguntas IA geradas em teste com fontes e aviso de não verificação.
- scripts/claude_enrich.py: integração autenticada com Claude Haiku, sem exposição da chave.
- scripts/import_artifacts.py: importação manual de Artifacts exportados.

Não são produzidas reportagens verificadas de modo autônomo. IA e arquivos
históricos devem permanecer distinguíveis do noticiário RSS atual.

## Testes

.github/workflows/validar-publicacao.yml:
- unittest e node --check, sem chamar Claude e sem cobrança.
- Chrome com site/index.html REAL em desktop e telas de 390px/320px.
- Checagem de editorias, busca, datas, abertura do arquivo, 689 registros e layout.
- Artifact painel-brasil-candidato-capturas: capturas visuais.
- Artifact painel-brasil-candidato-site: arquivos de site para revisão.
- Não faz deploy nem escreve na main.

Para testar localmente: python -m http.server 8000 --directory site
e abrir http://localhost:8000/index.html.

## Aprovação e ativação

1. Revisar a proposta visual e editorial e conferir testes verdes.
2. Obter autorização EXPLÍCITA do responsável para publicar.
3. Só então integrar o PR na main.
4. O workflow principal .github/workflows/atualizar.yml permanece o
   mesmo da main e publica no GitHub Pages depois do merge.
5. Conferir o site público; rollback possível com site/versao-anterior.html.

O workflow .github/workflows/claude-editorial.yml fica limitado a execução
MANUAL na main, sem cron ou trigger em push. O custo recorrente de IA e
a agenda diária deverão ser objeto de aprovação e mudança separada.

**É proibido fazer merge/publicação antes de aprovação explícita.**
