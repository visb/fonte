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
| 1 | 197 — remover o vínculo filho↔ministério | [OK] | api 1806 · e2e 623 · adm 1731 · ops 1311 | `1884270` | `6425b41` |
| 2 | 194 — casas com múltiplos coordenadores | [OK] | api 1828 · e2e 634 · adm 1749 · ops 1322 | `2c06a59` | `736c9e9` |
| 3 | 196 — remover filho da casa pela lista | [OK] | api 1849 · e2e 640 · adm 1770 · ops 1342 · offline 7 | `1aebb96` | `df316b3` |
| 4 | 195 — módulo de contribuição em produtos no ops | [OK] | api 1860 · e2e 645 · ops 1363 · web 6 · client 307 | `2d5ceb3` | `ad87ea3` |
| 5 | 198 — criar produto na declaração de contribuição | [OK] | api 1860 · adm 1773 · ops 1374 · web 5 | `2ab7c7a` | `18e3f9f` |

## Log

```
[OK] 197 — testes: api 1806/1806 · e2e 623/623 · adm 1731/1731 · ops 1311/1311 · cov api 93.07%
     (ministry 97.95%, resident 94.31%), adm 93.5%, ops 94.79% — commit: 1884270 — merge: 6425b41 — 2026-09-15
     PENDENTE-MANUAL: `pnpm test:ops` (Maestro) não rodou — exige emulador API ≤34 + APK; o
     `ministries.yaml` foi atualizado mas está por validar em aparelho.

[OK] 194 — testes: api 1828/1828 · e2e 634/634 · adm 1749/1749 · ops 1322/1322 · Playwright houses 12/12
     cov api 93.12% (house 96.25%, staff 98.14%), adm features/houses 99.62% — commit: 2c06a59 — merge: 736c9e9 — 2026-09-15
     Desvio consciente: `coordinators` é `HouseStaffSummary[]` (4 colunas), não `Staff[]` — a rota é
     lida por SERVANT e a entidade exporia CPF/RG/endereço. `useMenuAccess` entrou no escopo (mesmo gate).
```

> **Atenção do próximo disparo:** o working tree tem `docs/comunicacao/whatsapp-coordenadores-*.md`
> modificados de **antes** da rodada — não são de story nenhuma e **não** entram em commit de story.
>
> **Antes de aplicar a 197 em produção:** a migration é destrutiva e o `down()` devolve as colunas
> **vazias**. Backup do banco antes (skill `fonte-backup`) — o vínculo e o líder `RESIDENT` não voltam.

[OK] 196 — api 1849 + e2e 640; adm 1770 + e2e 32; ops 1342 + offline 7; api-client 305.
Cobertura API 93.15%, adm 93.65%, ops 94.84%, api-client 97.98%; builds verdes — commit `1aebb96`, merge `df316b3` — 2026-09-26.
Nota: `tsc --noEmit` ops ainda acusa erros preexistentes em testes; build Expo e gates obrigatórios verdes.

[OK] 195 — api 1860 + e2e 645; ops 1363 + web 6; api-client 307; builds verdes — commit `2d5ceb3`, merge `ad87ea3` — 2026-09-27.
Cobertura API 93.16%, ops 95.01% (feature 97.14%, offline 99.42%), api-client 97.99%.
Maestro atualizado, opcional não executado; 198 precisa resolver IDs locais das linhas no envio, reutilizando outbox existente.

## Resumo final

[OK] 198 — api 1860; adm 1773 + e2e 1; ops 1374 + e2e 4; builds verdes — commit `2ab7c7a`, merge `18e3f9f` — 2026-09-28.
Cobertura adm 93.68% (residents 98.90%), ops 94.90% (residents 93.10%); novo código residents 100%, helper offline 91.42%.
Correção final da mensagem de ID local: 32 testes focais + novo export + E2E de recusa/reload verdes; sem repetir as suítes completas após esse ajuste.

Rodada **194–198 encerrada em 2026-09-28**: cinco stories implementadas e mergeadas na `main` local, planos arquivados. Sem push ou PR. Nenhuma story bloqueada.

- 197: removido vínculo filho/ministério; 194: múltiplos coordenadores por casa.
- 196: baixa pela lista com permissões e transições validadas; 195: fila mensal de contribuições e declaração persistida offline.
- 198: criação de produto no formulário adm/ops, encadeamento offline com ID real e erro nomeado em `/sync`.
- Pendência manual opcional: Maestro das stories 197/195 não executado; gates web passaram. Typecheck completo ops ainda tem erros legados em testes; source-only e export web passaram.
- Baseline histórico da cobertura por feature não estava disponível na 198; percentuais atuais e cobertura de código novo foram medidos, sem afirmar comparação histórica.
- Alterações preexistentes em `.gitignore`, documentação de comunicação, `stories/AUTORUN.md`, `AGENTS.md`, `.agents/` e `.codex/` preservadas fora dos commits da rodada.
- API teste 3001 (CORS 5174/8083) e adm 5174 mantidos. Banco de teste reutilizado sem reseed. Produção não foi alterada.

Branches preservadas (commits e merges na tabela):

```text
refactor/story-197-remover-vinculo-filho-ministerio
feat/story-194-multiplos-coordenadores-por-casa
feat/story-196-remover-filho-da-lista
feat/story-195-contribuicoes-produtos-ops
feat/story-198-criar-produto-na-declaracao
```

Reprodução dos gates principais, PowerShell na raiz (API teste e adm disponíveis; executar suítes pesadas em sequência):

```powershell
pnpm.cmd build:types
pnpm.cmd build:api-client
pnpm.cmd build:api
pnpm.cmd test:api:cov --runInBand
pnpm.cmd test:api:e2e --runInBand
pnpm.cmd test:api-client:cov
pnpm.cmd test:adm:unit:cov
pnpm.cmd --filter adm.fonte build
pnpm.cmd test:ops:unit:cov --runInBand
pnpm.cmd --filter adm.fonte exec playwright test e2e/houses.spec.ts e2e/residents.spec.ts e2e/create-contribution-product.spec.ts --reporter=line
pnpm.cmd exec cross-env EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1 pnpm --filter ops.fonte exec expo export --platform web --max-workers 2
pnpm.cmd --filter ops.fonte exec playwright test e2e-web/offline-field-flows.spec.ts e2e-web/offline-resident-store.spec.ts e2e-web/product-contributions.spec.ts e2e-web/create-contribution-product.spec.ts --reporter=line
```

Os comandos acima reproduzem os gates; os resultados registrados pertencem aos checkpoints de cada story, não a uma nova execução integral após o último merge. Detalhes e ajustes de escopo estão nos commits de implementação.
