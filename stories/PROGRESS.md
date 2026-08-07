# PROGRESS — ledger ativo

## Config da rodada

- **Tema:** documentos gerados (variável de saída + disponibilidade por status), barra do PDF
  combinado e status do import em lote. Rodada 159–162, saída do `/planning` de 2026-08-07.
- **Stories:** 159, 160, 161, 162.
- **Branch base:** `main` (`3fda136`).
- **Ordem (com motivo):**
  1. **159** — isolada, back+front, sem contrato.
  2. **160** — migration + `packages/types` + `api-client` + Postman. Vai **antes** da 161 porque as
     duas tocam `AttachmentsTab.tsx`; cortando a branch da 161 da `main` já com a 160 mergeada, não
     há conflito.
  3. **161** — frontend puro, `AttachmentsTab.tsx` + `CombinedPdfBar.tsx` + `useDocumentGeneration`.
  4. **162** — frontend puro, `importCommit.ts` + `ImportFichaModal`. Independente das demais.
- **Deps rígidas:** nenhuma funcional. 160 → 161 é **ordem de merge** (mesmo arquivo), não bloqueio:
  se a 160 travar, a 161 segue mesmo assim (o filtro da 160 é aditivo).
- **Cuidados declarados:**
  - **Só a 160 mexe em contrato/schema.** Migration nova `AddDocumentTemplateAvailability`
    (timestamp > `1783037200000-UserPreferences`), `pnpm migration:run:test` obrigatório,
    `pnpm build:types && pnpm build:api-client` obrigatórios e
    `fonte-api.postman_collection.json` atualizado (POST/PUT `/document-templates` com
    `availableFor`). Nunca editar migration já aplicada.
  - **160 refatora código já testado:** `ACTIVE_RESIDENT_STATUSES` sai de
    `resident-receivable.service.ts:31` e `resident.service.ts:169` para `packages/types`. Critério:
    `resident.service.spec.ts` e `resident-receivable.service.spec.ts` rodam **inalterados**.
  - **160: `PRE_ADMISSION` conta como ATIVO** (decisão travada) — é o que mantém a ficha de
    acolhimento visível no wizard. `ARCHIVED`/`DISCHARGED`/`EVADED`/`CENSUS_ADDED`/`REJECTED_CENSUS`
    = não-ativo.
  - **161 remove `clearSelection`** do `useDocumentGeneration` — não deixar código morto; vira
    `toggleAll`. Checkbox `indeterminate` exige `ref` + efeito (não é atributo JSX).
  - **162 é frontend puro** — `import.service.ts` (regra de alta/evasão da story 120) fica
    **intocado**; a regressão da 120 é critério de aceite.
  - 159, 161 e 162 **não** tocam Postman nem contrato.
  - **Reseed antes da suíte adm** (`pnpm test:setup`): `test:api:e2e` suja o mesmo banco.
  - Gate de cobertura **≥90** no pacote tocado, sem `skip`/`only`/`xfail` injustificado.
- **Dependências externas sem credencial:** nenhuma nesta rodada.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 159 — variável `{{exitDate}}` nos documentos | [OK] | api 1325 · api-e2e 500 · adm-unit 1473 | `9797cde` | `e577b58` |
| 2 | 160 — template disponível por status do filho | [OK] | api 1389 · api-e2e 509 · adm-unit 1494 · api-client 267 | `c1bdafd` | `e0d963f` |
| 3 | 161 — barra do PDF combinado sempre visível | [ ] | — | — | — |
| 4 | 162 — import em lote com status ativo | [ ] | — | — | — |

## Log

- [OK] 159 — testes: api 119 suítes/1325, api-e2e 33/500, adm unit 213 arquivos/1473; cobertura
  `document-template.service.ts` 96% stmts / 90,6% branch, `documentFields.ts` e
  `templateVariables.ts` 100% — commit: `9797cde` — merge: `e577b58` — 2026-08-07.
- Nota: o e2e novo altera `exit_date` de dois filhos do seed e **restaura no `afterAll`** — não
  deixa estado no banco de teste.
- [OK] 160 — testes: api 120 suítes/1389, api-e2e 33/509, adm unit 214 arquivos/1494, api-client 267;
  migration `1783037300000-AddDocumentTemplateAvailability` aplicada no DB de teste; Postman
  atualizado — commit: `c1bdafd` — merge: `e0d963f` — 2026-08-07.
- Nota 160: `resident.service.spec.ts` e `resident-receivable.service.spec.ts` ganharam **uma linha**
  cada (`...jest.requireActual('@fonte/types')` na factory do mock) — os mocks exaustivos apagavam a
  constante nova; **nenhuma asserção mudou**. `AttachmentsTab` com `resident` ainda `undefined`
  aplica o predicado sem exceção (só `ALL` sobrevive), preservando a regressão da story 152.
- **PENDENTE-MANUAL 160:** migration **não** aplicada em dev/produção (o `.env` local do api aponta
  para produção) — rodar `migration:run` no deploy.

## Resumo final

<vazio>
