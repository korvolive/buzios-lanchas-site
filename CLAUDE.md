# Segurança

Antes de qualquer mudança, leia e siga `SEGURANCA.md` (regras de desenvolvimento seguro assumidas com o Asaas).

# Mapa do projeto (Graphify)

Este repositório tem um mapa pronto do código em `graphify-out/` (graph.json, GRAPH_REPORT.md, graph.html).

- Antes de sair abrindo muitos arquivos, leia `graphify-out/GRAPH_REPORT.md` e consulte o mapa:
  `graphify query "<pergunta>"`, `graphify explain "<nome>"`, `graphify affected "<nome>"`.
- Se o comando `graphify` não existir na sessão, instale com `pip install "graphifyy[sql]"`.
- Depois de mudar código, atualize o mapa (é rápido e não gasta token) e inclua no mesmo commit:
  `graphify update . && graphify cluster-only . --no-label`
- Limite: o código JavaScript dentro dos arquivos `.html` (index.html, login/index.html etc.) não entra no mapa. Para essas páginas, use busca normal.
- `graphify-out/` e `CLAUDE.md` não vão para o site (excluídos no deploy).
