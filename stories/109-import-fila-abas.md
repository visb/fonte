# Plan: Import em lote — dividir a fila em abas (fila | processadas | aprovadas | canceladas)

> **Status: PLANEJAMENTO.** Melhoria pós-epic [[100]] (import em lote). Frontend-only.

## Context

A tela de import em lote ([[104]]) hoje mostra todas as fichas selecionadas numa lista única. Com
muitos arquivos, fica difícil distinguir o que ainda está extraindo, o que está pronto pra aprovar,
o que já foi importado e o que foi descartado. Dividir em **abas** organiza a fila por estágio.

Estados atuais do item (`ImportItemStatus` em `constants.ts`): `queued`, `processing`, `ready`,
`error`, `imported`. Hoje **remover deleta** o item da lista (`useImportQueue.removeItem`).

### Decisões travadas

- **4 abas**: `fila | processadas | aprovadas | canceladas`. Mapeamento de status → aba:
  - **Fila** = `queued` + `processing` (ainda extraindo).
  - **Processadas** = `ready` + `error` (extração concluída — prontas pra aprovar, ou falhas). Item
    com erro aparece aqui com badge `destructive`.
  - **Aprovadas** = `imported` (commit concluído).
  - **Canceladas** = novo status `cancelled` (removidas pelo usuário).
- **Novo status `cancelled`**: remover **deixa de deletar**. `removeItem` passa a marcar o item como
  `cancelled`; ele sai das outras abas e aparece em Canceladas. Permite auditar/reverter.
  - Adicionar ação **Restaurar** no card cancelado → volta ao status pré-cancelamento apropriado
    (`ready` se já tinha preview; `queued` se ainda não). Manter simples: restaurar para `queued`
    re-agenda a extração se não houver preview; se já houver preview, volta para `ready`.
  - `filesRef`/preview do item **não** são descartados ao cancelar (só ao restaurar-e-reprocessar,
    se aplicável), pra permitir a volta.
- **Contadores por aba**: cada aba mostra a contagem de itens. Reusar/estender `pendingCount` e
  `processingCount` já expostos por `useImportQueue`.
- Aba ativa default = **Fila** (ou Processadas quando a fila esvazia — decisão de UX menor, deixar
  Fila fixo por ora).
- Sem mudança de backend nem de contrato — tudo estado de fila no front.

## Desenho

### Frontend (`adm.fonte`, feature `residents`)

- **`constants.ts`**: adicionar `'cancelled'` ao `ImportItemStatus`, com label ("Cancelado") e
  variant (`secondary`/`muted`). Definir o agrupamento status → aba (ex: um `IMPORT_TAB_STATUSES:
  Record<ImportTab, ImportItemStatus[]>`).
- **`useBulkImport.ts` (`useImportQueue`)**:
  - `removeItem` → renomear conceito para "cancelar": marca `cancelled` em vez de filtrar da lista
    (não apaga `filesRef`).
  - Novo `restoreItem(id)`: volta o item para `ready` (tem preview) ou `queued` (sem preview,
    re-agenda extração).
  - Expor contagens por aba (ou um helper que agrupa `items` por aba) para os badges.
- **Página da fila** (`ResidentsPage`/componente da lista de import): envolver a lista num `Tabs`
  (shadcn/ui) com as 4 abas; cada aba filtra `items` pelo grupo de status e renderiza os
  `ImportItemCard` correspondentes. `EmptyState` por aba vazia.
- **`ImportItemCard`**: no estado `cancelled`, trocar o botão Remover por **Restaurar**; ocultar
  ações de aprovação. Ajustar o `Trash2`/tooltip conforme a aba.
- Estados/erros via componentes compartilhados (`EmptyState`, `LoadingState`).

## Validação

Gate: **código novo sem teste não fecha a story** (runner de cobertura do `adm.fonte`; sem
`skip`/`only`/`xfail` injustificado).

- **Unit (Vitest/RTL)**:
  - `useImportQueue`: `removeItem` marca `cancelled` (não deleta); `restoreItem` volta para `ready`
    (com preview) ou `queued` (sem); agrupamento status → aba correto; contadores por aba.
  - Componente de abas: cada aba lista só os itens do seu grupo; aba vazia mostra `EmptyState`;
    badges de contagem corretos.
  - `ImportItemCard`: estado `cancelled` mostra Restaurar e esconde Aprovar.
- **`pnpm test:adm`** (Playwright): subir planilha + fichas → itens aparecem em Fila, migram para
  Processadas ao extrair; aprovar um → vai para Aprovadas; cancelar um → vai para Canceladas;
  restaurar → volta para Processadas.

## Fora de escopo

- Persistir a fila entre sessões/reload (continua em memória).
- Ações em massa por aba (aprovar/cancelar todos) — story própria se necessário.
- Popover de alertas ([[107]]) e histórico de contribuição ([[108]]) — stories próprias.
