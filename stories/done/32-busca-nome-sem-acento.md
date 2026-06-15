# Plan: Busca de pessoas por nome insensível a acento

## Context

Ao matricular filhos no curso bíblico (`EnrollResidentDialog`), buscar por `joao` **não
encontra** `João` cadastrado no banco. A busca diferencia acentuação e não deveria — o usuário
raramente digita acento ao pesquisar.

### Investigação (onde a busca acontece)

O `EnrollResidentDialog` delega a busca ao backend via `useInfiniteResidents({ search })`. A raiz
do bug está em `services/api/src/modules/resident/resident.service.ts` (`findAll`):

```ts
qb.andWhere('LOWER(resident.name) LIKE LOWER(:search)', { search: `%${search}%` });
```

`LOWER(...) LIKE LOWER(...)` resolve só maiúscula/minúscula — **não remove acento**. `joao`
nunca casa `João`. É o mesmo `findAll` usado pela listagem de internos (`adm.fonte` e
`ops.fonte`), então o conserto beneficia toda busca server-side de internos.

Varredura por outros pontos de busca de nome (filhos/servos/familiares):

- **Backend** — só `resident.service.ts` faz busca SQL por nome. `staff.service.ts` e
  `relative.service.ts` listam ordenado por nome mas **não** têm filtro de busca por texto.
- **Frontend (filtro client-side, mesmo bug de acento)** — todos usam
  `x.name.toLowerCase().includes(query.toLowerCase())`:
  - `adm.fonte`: `houses/components/LeaderAutocomplete.tsx` (servos/líderes),
    `houses/components/tabs/AddMinistryDialog.tsx` (internos).
  - `ops.fonte`: `support-groups/pages/MeetingDetailPage.tsx`,
    `ministries/components/CreateMinistryModal.tsx`,
    `ministries/components/MinistryOverviewTab.tsx` (internos **e** servos),
    `residents/pages/ResidentsPage.tsx`.
- Há precedente de normalização NFD no repo (`AttachmentsTab.tsx` `slugify`,
  `ImportReviewStep.tsx`) — reaproveitar o padrão num helper nomeado.

Fora de escopo do pedido (busca de **itens**, não pessoas), mesmo bug, **não** tocados nesta
story: `ops.fonte` supply-room/storeroom `ItemSearchInput.tsx`. Anotado para story futura.

### Decisões (travadas)

- **Backend usa a extensão `unaccent` do Postgres** + `unaccent(LOWER(...)) LIKE
  unaccent(LOWER(...))`. Migration cria a extensão (`CREATE EXTENSION IF NOT EXISTS unaccent`).
  É contrib padrão, disponível em RDS/Cloud SQL/postgres oficial; não exige superuser em managed
  DB. Sem índice funcional — volume de internos é pequeno, `LIKE %x%` já não usa índice.
- **Frontend ganha um helper `normalizeForSearch(text)`** por app (adm e ops não compartilham
  pacote de utils): `lowercase` + `NFD` + remove diacríticos. Trocar todos os
  `name.toLowerCase().includes(query.toLowerCase())` de busca de **pessoas** por
  `normalizeForSearch(name).includes(normalizeForSearch(query))`.
- O filtro de CPF (busca com dígitos) no `resident.service.ts` permanece igual.

## Desenho

### Backend
- Nova migration `NN-UnaccentExtension.ts`: `CREATE EXTENSION IF NOT EXISTS unaccent` (up),
  `DROP EXTENSION IF EXISTS unaccent` (down).
- `resident.service.ts` `findAll`: trocar as duas cláusulas de nome para
  `unaccent(LOWER(resident.name)) LIKE unaccent(LOWER(:search))`.
- Atualizar `resident.service.spec.ts` (asserts da string SQL esperada).

### Frontend
- `adm.fonte/src/lib/utils.ts`: exportar `normalizeForSearch(text: string): string`.
- `ops.fonte/lib/`: novo `searchUtils.ts` (ou em `constants.ts`) com o mesmo helper.
- Substituir os filtros client-side de busca de pessoas listados acima.

## Validação

- `pnpm test:api` (inclui `resident.service.spec.ts` atualizado) — verde.
- Caso novo no spec: busca `joão` casa `joao` na cláusula SQL (assert da string com `unaccent`).
- `pnpm build:api` compila a migration.
- Smoke manual: matricular filho buscando sem acento encontra nome acentuado.
- Atualizar `fonte-api.postman_collection.json` **não** necessário (sem mudança de
  contrato/rota; só comportamento interno do filtro).

## Fora de escopo

- Busca de **itens** (supply-room/storeroom) — mesmo bug, story futura.
- Busca fonética/fuzzy (Levenshtein, trigram `pg_trgm`). Só acento aqui.
- Índice funcional `unaccent` (exigiria função IMMUTABLE wrapper) — desnecessário no volume atual.
