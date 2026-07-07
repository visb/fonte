# Plan: Unificar almoxarifado + dispensa num catálogo de inventário compartilhado

> **Status: PLANEJAMENTO.** Filha 1 de [[110]]. Refactor — roda ANTES das demais filhas.

## Context

`storeroom` (almoxarifado) e `supply_room` (dispensa) são módulos quase idênticos: item com
`name`/`unit`/`house_id`/`current_quantity` + movimentos IN/OUT (`type`, `quantity`, `responsible`,
`date`, `notes`). Diferenças: `storeroom_items` tem `weekly_average_usage*`; `supply_room_items` tem
`category` (`SupplyRoomCategory`). O epic [[110]] precisa que a contribuição-produtos referencie
**um único catálogo**. Esta story unifica os dois **antes** das demais filhas, isolando o risco do
refactor.

### Decisões travadas

- **Tabela única com discriminador**: `inventory_items` com coluna `kind` (`STOREROOM` | `SUPPLY_ROOM`),
  colunas comuns + as específicas de cada tipo nullable (`weekly_average_usage*` só p/ storeroom;
  `category` só p/ supply_room). Movimentos unificados em `inventory_movements` apontando para
  `inventory_items`.
- **Migração com backfill, sem perda**: nova migration cria as tabelas unificadas, **copia** os dados
  de `storeroom_items`/`supply_room_items` (+ movimentos) preservando `id`s (para não quebrar FKs/
  histórico), popula `kind`. Manter as tabelas antigas por ora (drop numa migration futura, após
  validação) OU renomear — **decisão travada: criar novas tabelas e migrar dados; deixar o drop das
  antigas para migration posterior** (reduz risco de rollback). Nunca editar migration existente.
- **Camada de serviço preserva o comportamento atual** de cada inventário: os módulos `storeroom` e
  `supply-room` passam a operar sobre o repositório unificado filtrando por `kind`, mantendo suas
  rotas e contratos de saída **inalterados** (as telas ops/adm não mudam de API). O `weekly_average`
  scheduler continua só sobre `kind = STOREROOM`.
- **Telas ops/adm dos dois inventários continuam funcionando igual** — mudança é interna; ajustar só
  o necessário para consumir a base unificada sem alterar UX.

## Desenho

### Backend (`services/api`)

- **Entities**: `InventoryItem` (`inventory_items`, com `kind`) e `InventoryMovement`
  (`inventory_movements`). Abstrair campos comuns; específicos nullable por `kind`.
- **Migration** `<ts>-UnifyInventoryCatalog.ts`: cria tabelas unificadas + enum `kind`; backfill
  copiando storeroom/supply-room (itens e movimentos) preservando ids; índices equivalentes. `down`
  reverte (drop das novas).
- **Módulos** `storeroom` e `supply-room`: repositórios passam a consultar `inventory_items`/
  `inventory_movements` filtrando `kind`; serviços mantêm assinatura e views de saída atuais.
  Alternativa de organização: extrair um `inventory` compartilhado consumido pelos dois módulos —
  decidir na implementação mantendo os contratos externos.
- **Postman**: se alguma rota/response mudar (não deveria), refletir; caso contrário, sem mudança.

### packages/types & api-client

- Se surgir tipo compartilhado do catálogo unificado, adicionar em `packages/types`; manter os tipos
  de storeroom/supply-room expostos hoje **estáveis** para não quebrar as telas.

## Validação

Gate: **código novo sem teste não fecha a story** (`pnpm test:api:cov` do escopo tocado; runners
dos apps se telas mudarem; sem `skip`/`only`/`xfail` injustificado).

- **Migration**: `pnpm migration:run:test` aplica; conferir backfill (contagem de itens/movimentos
  igual antes/depois; ids preservados; `kind` correto).
- **Unit (Jest)**: `storeroom.service.spec` e `supply-room.service.spec` continuam verdes sobre a
  base unificada; `storeroom-usage.scheduler.spec` opera só sobre `kind = STOREROOM`.
- **E2E (`pnpm test:api:e2e`)**: rotas de storeroom e supply-room retornam o mesmo shape de antes;
  criar item/movimento em cada e ler de volta.
- **Runners de app** (`test:ops` e/ou `test:adm`) se alguma tela dos inventários for tocada.
- `pnpm build:types` / `pnpm build:api-client` compilam.

## Fora de escopo

- Modelo de contribuição-produtos e movimento IN de doação ([[112]]).
- Drop físico das tabelas antigas `storeroom_items`/`supply_room_items` (migration posterior).
- Unificar/renomear as telas ops/adm dos dois inventários numa só (continuam separadas por UX).
