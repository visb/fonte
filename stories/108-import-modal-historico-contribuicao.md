# Plan: Import em lote — histórico de contribuição no modal "ver ficha"

> **Status: PLANEJAMENTO.** Melhoria pós-epic [[100]] (import em lote). Frontend-only.

## Context

No modal "ver ficha" do import em lote (`ImportFichaModal`, [[105]]) não há exibição do histórico de
contribuição. Os meses retroativos parseados da planilha já chegam ao front em
`preview.contributionMonths` e hoje entram apenas como default do form (`contributionMonths`), sem
serem mostrados ao usuário. Falta uma seção que **exiba esse histórico** para o usuário conferir
antes de aprovar.

### Decisões travadas

- **Fonte de dado = `preview.contributionMonths`** (meses/valores retroativos parseados da planilha,
  que serão criados no commit atômico [[103]]). O resident ainda não existe no banco durante o
  import, então esse é o único histórico disponível — **não** buscar recebíveis do banco.
- **Read-only**: só exibir o que veio no preview (mês, valor, e o que mais o shape trouxer). Editar
  as contribuições retroativas está fora de escopo desta story.
- Sem mudança de backend nem de contrato: `contributionMonths` já vem no `ImportPreviewResult`.

## Desenho

### Frontend (`adm.fonte`, feature `residents`)

- **`ImportFichaModal`**: nova seção "Histórico de contribuição" listando cada item de
  `preview.contributionMonths` (mês/competência + valor formatado). Renderiza só quando houver ao
  menos um item; caso contrário, estado vazio compartilhado (`EmptyState`).
- Extrair o item da lista como componente próprio se a linha tiver apresentação não-trivial
  (evitar item inline complexo — CLAUDE.md). Formatar valores em BRL e competência de forma legível.
- Reusar tipos de `contributionMonths` já definidos no preview/`@fonte/api-client`; não redefinir
  shape.

## Validação

Gate: **código novo sem teste não fecha a story** (runner de cobertura do `adm.fonte`; sem
`skip`/`only`/`xfail` injustificado).

- **Unit (Vitest/RTL)**:
  - `ImportFichaModal`: com `contributionMonths` preenchido, a seção lista os meses/valores; vazio →
    `EmptyState` (ou seção some, conforme desenho).
  - Componente de linha (se extraído): formata competência e valor corretamente.
- **`pnpm test:adm`** (Playwright) se o spec do fluxo de import for afetado — cobrir a exibição do
  histórico ao abrir a ficha.

## Fora de escopo

- Editar/adicionar/remover contribuições retroativas no modal (só exibição).
- Buscar carnê/recebíveis do banco (resident é novo no import).
- Popover/seção de alertas ([[107]]) e abas da fila (story própria).
