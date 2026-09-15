# PROGRESS — ledger ativo

Rodada de autorun **194–198** — aberta em 2026-09-15.

## Config da rodada

- **Tema:** limpeza do vínculo filho↔ministério, coordenadores por casa, e o ciclo de contribuição
  em produtos no `ops.fonte` (módulo próprio, baixa de filho pela lista, cadastro de produto na
  declaração).
- **Ordem:** 197 → 194 → 196 → 195 → 198
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:**
  - **196 → 195 → 198** — as três tocam `apps/ops.fonte/features/residents/` e o conjunto
    `ProductContribution*`. Fora de ordem, conflitam. Se 196 bloquear, 195 e 198 bloqueiam junto.
  - **197 antes de tudo** — dropa `residents.ministry_id`/`admissions.ministry_id` e muda o contrato
    de `Resident`. Feita depois, obrigaria rebase de tudo que já mexeu em `features/residents`.
  - **194 antes de 196** — 194 mexe em `StaffService` e no gate de `HouseSettingsPage`; 196 mexe no
    gate de role da lista de filhos. Independentes em arquivo, mas 194 estabelece o padrão de
    `staff.user.role` que 196 reusa.
- **Escopo técnico por story:**
  - **197** — migration destrutiva (2 `DROP COLUMN` + zera líder `RESIDENT`); `packages/types` e
    `api-client` (campos removidos); 2 rotas removidas; Postman; `ops` + `adm`;
    `PERSIST_BUSTER` → `v2`.
  - **194** — sem migration; `packages/types` (`House.coordinators`); `HouseService` + `StaffService`;
    Postman (campo novo + 2 respostas 400); `adm` + `ops`.
  - **196** — sem migration; `packages/types` (`REMOVABLE_RESIDENT_STATUSES`, rótulos); guard em
    `ResidentService.update`; Postman (400 novo); `ops` + `adm`.
  - **195** — sem migration; endpoint novo `GET /houses/:id/product-contributions`; `api-client`;
    Postman; `ops` (feature nova `contributions` + outbox key nova).
  - **198** — sem migration, sem rota nova, sem contrato novo; só `ops` + `adm`.
- **Cuidados da rodada:**
  - **`migration:run:test` — NUNCA `migration:run`.** `data-source.ts:2` carrega `.env.test` só
    quando `NODE_ENV=test`; sem isso lê `services/api/.env`. A migration da 197 é `DROP COLUMN` e o
    `down()` recria as colunas **vazias**. Comando errado = perda irreversível.
  - **Nunca `pnpm dev:api`** durante o run (usa `.env`); só `pnpm dev:api:test` (porta 3001).
  - `pnpm build:types && pnpm build:api-client` **depois** de 197, 194, 196 e 195 — as quatro mexem
    em contrato compartilhado. Sem o `dist/` atualizado a suíte do `adm` quebra inteira.
  - **197 e 198 mexem em `lib/offline/` do `ops`**: 197 muda `PERSIST_BUSTER` e move
    `'house-ministries'` de allowlist; 198 **não** deve criar chave/mutation nova (reusa
    `storeroomCreateItem`/`supplyRoomCreateItem`). 195 cria chave de outbox nova.
  - **195 não pode mudar `mutationKey` existente** e **196 não pode mudar
    `OUTBOX_MUTATION_KEYS.residentUpdateStatus`** ao mover as hooks: chave trocada abandona na fila o
    lançamento pendente de quem atualizar o app.
  - Postman (`fonte-api.postman_collection.json`) atualizado em 197, 194, 196 e 195.
  - Gate de cobertura ≥ 90 no escopo de cada story; sem `skip`/`only`/`xfail` injustificado.
  - Sem dependência externa sem credencial nesta rodada — nenhuma story chama WhatsApp, pagamento,
    bucket ou Sentry.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 197 — remover o vínculo filho↔ministério | [ ] | | | |
| 2 | 194 — casas com múltiplos coordenadores | [ ] | | | |
| 3 | 196 — remover filho da casa pela lista | [ ] | | | |
| 4 | 195 — módulo de contribuição em produtos no ops | [ ] | | | |
| 5 | 198 — criar produto na declaração de contribuição | [ ] | | | |

## Log

```
(vazio — rodada recém-aberta)
```

## Resumo final

<vazio até o fim da rodada>
