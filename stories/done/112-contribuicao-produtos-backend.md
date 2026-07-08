# Plan: Backend — contribuição em produtos na declaração da parcela

> **Status: PLANEJAMENTO.** Filha 2 de [[110]]. Depende de [[111]] (catálogo unificado).

## Context

A declaração de pagamento da parcela (`ResidentReceivable`) hoje só registra valor monetário
(`paidAmount`/`paidFamilyInvestment`, [[15]]). O epic [[110]] exige registrar **também** a
contribuição em **produtos**. Esta story adiciona o modelo e os endpoints; o front vem em [[113]]
(adm) e [[114]] (ops).

### Decisões travadas

- **Nova entity `receivable_product_contributions`** (uma linha por produto declarado), ligada à
  parcela (`receivable_id`) e ao filho. Campos:
  - **Modo catálogo**: `inventory_item_id` (FK ao catálogo unificado [[111]]) + `quantity` + `unit`
    (snapshot) → **gera movimento IN** no inventário; `inventory_movement_id` guarda o vínculo.
  - **Modo avulso**: `description` (texto livre, ex: "cesta básica") + `quantity`/`unit` opcionais,
    `inventory_item_id`/`inventory_movement_id` nulos, flag `pending_detailing = true` → **não** gera
    movimento de estoque. Exatamente um dos modos por linha (validar: item XOR descrição).
- **Movimento IN vinculado** (modo catálogo): ao declarar, criar `InventoryMovement` `IN` no item,
  `responsible` = staff autenticado, `notes` referenciando a contribuição. Sem estorno: remover uma
  linha catálogo cria movimento de correção (novo lançamento), não deleta o IN (`BUSINESS_RULES.md`).
- **Amarra à parcela**: contribuições de produto pertencem a uma `ResidentReceivable`. Independem do
  pagamento em dinheiro — uma parcela pode ter valor, produtos, ou ambos.
- **Permissões**: declarar/listar contribuição de **produtos** liberado para SERVANT+ (ops usa);
  declarar **valor** (`registerPayment`) continua ADMIN/COORDINATOR. Guardas por rota.
- **Relatório de arrecadação não soma produtos em R$** — produtos são contribuição em espécie;
  aparecem como contagem/lista, não no `totalCollectedAmount`.

## Desenho

### Backend (`services/api`, módulo `resident-receivable`)

- **Entity** `ReceivableProductContribution` (`receivable_product_contributions`): `id`, `receivable_id`,
  `inventory_item_id` (nullable), `inventory_movement_id` (nullable), `description` (nullable),
  `quantity` (numeric, nullable no modo avulso), `unit` (nullable), `pending_detailing` (bool),
  `created_by` (staff), timestamps, soft delete.
- **Migration** `<ts>-ReceivableProductContributions.ts`: cria a tabela + FKs + índices; `down` dropa.
- **DTO** `declare-product-contribution.dto.ts`: `receivableId`, e por linha
  `{ inventoryItemId?, description?, quantity?, unit? }` com `class-validator` garantindo item XOR
  descrição e quantidade > 0 no modo catálogo.
- **Service**: método que valida, cria as linhas e, no modo catálogo, lança o movimento IN atômico
  (transação) e grava `inventory_movement_id`. Método de listar por parcela/filho. Remoção =
  correção por novo lançamento.
- **Controller**: rotas para declarar e listar contribuição de produtos da parcela; guardas de role.
- **View/saída**: incluir as contribuições de produto no retorno da parcela/aba de contribuições.
- **Postman**: adicionar/atualizar os endpoints (obrigatório).

### packages/types & api-client

- Tipos `ReceivableProductContribution` + inputs de declarar/listar em `packages/types` e métodos no
  `@fonte/api-client`.

## Validação

Gate: **código novo sem teste não fecha a story** (`pnpm test:api:cov` do escopo; sem
`skip`/`only`/`xfail` injustificado).

- **Unit (Jest)**: service — modo catálogo cria linha **e** movimento IN vinculado (estoque sobe);
  modo avulso cria linha `pending_detailing` **sem** movimento; validação item-XOR-descrição barra
  entrada inválida; remoção gera correção sem apagar o IN.
- **E2E (`pnpm test:api:e2e`)**: declarar produtos numa parcela (catálogo + avulso) → 200; `GET` da
  parcela lista as contribuições; item de catálogo refletiu no estoque do inventário; guarda de role
  (SERVANT pode produtos; valor continua restrito).
- `pnpm migration:run:test` aplica a migration.
- `pnpm build:types` / `pnpm build:api-client` compilam.

## Fora de escopo

- UI adm ([[113]]) e ops ([[114]]).
- Distrinchar automaticamente a linha avulsa em produtos (logística faz manual depois).
- Somar produtos em valor monetário no relatório.
