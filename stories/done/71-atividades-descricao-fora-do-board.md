# Plan: Atividades — descrição fora do board (só nos detalhes)

## Context

Follow-up do módulo Atividades (story 48 `done/48-atividades-kanban.md`) e da story 62
(`done/62-atividades-modal-detalhes-descricao.md`, que entregou o `ActivityDetailsDialog`).
Item 1 do BACKLOG: **a descrição não deve aparecer no board — só no modal/tela de detalhes.**

Hoje o `ActivityCard` (adm) renderiza um trecho da descrição (`line-clamp-3`) e a lista de
atividades do `ops.fonte` também a exibe. O modal de detalhes (story 62) busca a atividade por
`getById` (`useActivity`), que é independente da listagem — logo, **o detalhe não depende da
descrição vir no payload de lista**.

### Decisões travadas

- **Escopo: `adm.fonte` + `ops.fonte`.** Remover a descrição do `ActivityCard` (adm) e da
  lista/card de atividades do ops.
- **Cortar a descrição do payload de listagem** (decisão de produto/perf): `GET /activities`
  (`findAll`) **não envia mais** `description`; `GET /activities/:id` (`findOne`) continua
  enviando. O board e a lista nunca mais carregam texto que não usam.
- **`Activity.description` vira opcional** em `@fonte/types` (`description?: string | null`).
  A listagem omite; o detalhe (getById) inclui. O modal já usa getById, então segue funcionando.
- Sem mudança de rota, método, params ou status code → contrato HTTP estável; só muda o **shape**
  do item de lista (campo a menos). Atualizar a coleção Postman para refletir que a lista não traz
  `description`.

## Desenho

### Backend (`services/api/src/modules/activity/`)

- `activity.service.ts`: separar a view de lista da view de detalhe. `toView` ganha a descrição
  só no caminho de detalhe — ex.: `toListView(a, createdBy)` (sem `description`) usado em
  `findAll`, e `toView` (com `description`) mantido em `findOne`/`create`/`update`/`changeStatus`.
  Não duplicar lógica desnecessária (extrair base comum se ficar mais limpo).
- `activity.service.spec.ts`: cobrir que `findAll` retorna itens **sem** `description` e que
  `findOne` retorna **com** `description`.
- Conferir `fonte-api.postman_collection.json`: ajustar o exemplo de response de `GET /activities`
  removendo `description` do item de lista; manter em `GET /activities/:id`.

### packages/types / api-client

- `Activity.description` passa a `description?: string | null`. `pnpm build:types`.
- Sem novos métodos no api-client. Reconstruir se o tipo mudar (`pnpm build:api-client`).

### Frontend adm.fonte (`apps/adm.fonte/src/features/activities/`)

- `components/ActivityCard.tsx`: **remover** o bloco
  `{activity.description && <p ...>{activity.description}</p>}` (linhas ~81–82). O card fica só com
  título/status/responsável/etc.
- O `ActivityDetailsDialog` não muda — já busca por `getById`. Conferir que TS continua válido com
  `description` agora opcional (a `DescriptionSection` lê de `activity.description`, que no detalhe
  continua presente).
- Conferir os consumidores da lista que tocam `description` (ex.: `lib/resolveDrop.test.ts` usa
  `description: null` no mock — manter compatível com o tipo opcional).

### Frontend ops.fonte (`apps/ops.fonte/features/activities/`)

- Remover a exibição da descrição no card/linha da lista de atividades (mantendo a descrição na
  tela/modal de detalhes, que usa getById). Ajustar qualquer tipagem local que assumia
  `description` sempre presente na lista.

## Validação

- Backend: `pnpm test:api` verde, com os casos novos (lista **sem** `description`, detalhe **com**).
- `pnpm build:types` + `pnpm build:api-client` (tipo alterado).
- **adm**: `pnpm --filter adm.fonte build` (typecheck). Smoke: board não mostra mais descrição no
  card; abrir o card → modal mostra a descrição normalmente.
- **ops**: typecheck/compila. Smoke (se emulador): lista sem descrição; detalhe com descrição.
- **Gate de cobertura (trava a story):** todo caminho novo/alterado tem teste. Backend: o split
  `toListView`/`toView` coberto por spec (presença/ausência de `description`). Frontend: se houver
  teste de render do `ActivityCard`, garantir que não referencia mais descrição; ajustar mocks.
  Rodar `pnpm test:api:cov` + runner de cobertura do `adm.fonte`; **não reduzir** a cobertura do
  módulo `activity` nem da feature `activities`. Sem `skip`/`only`/`xfail` injustificado (CLAUDE.md).

## Fora de escopo

- WYSIWYG / formatação rica na descrição (item 2 / story 72).
- Anexos e áudio (itens 3 e 4).
- Qualquer mudança nas regras de edição/permissão da descrição (story 62) ou de status (story 48).
