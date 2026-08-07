# PROGRESS — rodada 159–162 (encerrada)

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
| 3 | 161 — barra do PDF combinado sempre visível | [OK] | adm-unit 1525 · api 1389 (regressão) | `78e6e88` | `6dc0b66` |
| 4 | 162 — import em lote com status ativo | [OK] | adm-unit 1530 · api 1389 (regressão) · pw bulk-import 5 · pw residents 29 | `06ce515` | `ecacde6` |

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
- [OK] 161 — testes: adm unit 216 arquivos/1525, api 120/1389 (regressão, backend intocado);
  cobertura `CombinedPdfBar.tsx`, `useDocumentGeneration.ts` e `AttachmentsTab.tsx` 100%,
  `features/residents` 98,8% stmts — commit: `78e6e88` — merge: `6dc0b66` — 2026-08-07.
- **PENDENTE-MANUAL 161:** e2e do ciclo completo (marcar todos → gerar → seleção limpa) não escrito —
  **não existe spec Playwright da aba de anexos do filho** e o `seed-test.ts` não cria
  `document_template`; seedar um template obrigatório poluiria as outras suítes. Precisa de story de
  infra de seed E2E de templates.

- [OK] 162 — testes: adm unit 216 arquivos/1530, api 120/1389 (regressão, backend intocado),
  Playwright `bulk-import` 5/5 (spec novo) e `residents` 29/29; cobertura `importCommit.ts` 100%
  stmts / 97,5% branch, `ImportFichaModal.tsx` 100% stmts, `features/residents` 98,83% stmts (não
  reduziu) — commit: `06ce515` — merge: `ecacde6` — 2026-08-07.
- Nota 162: guarda de escolha manual do ADM validada por mutação (removê-la faz o teste "status
  escolhido à mão" falhar). Achado fora do escopo: o badge da ficha `unmatched` ainda diz
  **"Arquivado"** / "será importado como arquivado" (`features/residents/constants.ts:255-257`) —
  texto passou a ser factualmente errado quando a ficha tem casa e entra ATIVA. Registrado no
  `BACKLOG.md`.

## Resumo final

**Entregue: 4/4 stories, todas verdes e mergeadas na `main` local.** Nada BLOQUEADO.

- **159** — `{{exitDate}}` é a 25ª variável de texto dos documentos. Fallback proposital
  `não informado` (e não o traço `___/___/______` das outras datas), porque filho sem saída é o caso
  normal. Nunca abre o `MissingFieldsDialog`.
- **160** — a maior da rodada: `document_templates.available_for`
  (`ALL`/`ACTIVE_ONLY`/`INACTIVE_ONLY`, default `ALL`, migration `1783037300000`). O filtro esconde o
  card na aba de anexos **e** o backend recusa gerar (400) nos três caminhos
  (`renderForResident`, `generatePdf`, `generateCombinedPdf`). `PRE_ADMISSION` conta como **ativo**,
  o que mantém a ficha de acolhimento visível no wizard. Trouxe junto a unificação de
  `ACTIVE_RESIDENT_STATUSES` em `packages/types` (antes duplicado em dois services), com os specs
  dos dois rodando sem asserção alterada. Postman atualizado.
- **161** — barra do PDF combinado agora é fixa (sem salto de layout), botão desabilitado até haver
  seleção, "Limpar seleção" removido e checkbox tri-estado de marcar/desmarcar todos. `clearSelection`
  virou `toggleAll` — sem código morto. Seleção limpa no sucesso, preservada no erro.
- **162** — ficha fora da planilha com casa reconhecível entra **ATIVA**; sem casa reconhecível
  continua `ARCHIVED` (é o único status que o backend aceita sem casa). O import individual
  compartilha a função e foi corrigido junto. A derivação alta/evasão da story 120 segue intacta.

**PENDENTE-MANUAL (2):**

1. **Migration da 160 não foi aplicada em dev/produção** — o `.env` local do `api` aponta para o
   banco de produção, então nada foi rodado lá de propósito. Rodar `migration:run` no deploy.
2. **E2E da aba de anexos (161) não existe** — não há spec Playwright dessa aba e o `seed-test.ts`
   não cria `document_template`; seedar um template obrigatório poluiria as demais suítes. Precisa de
   uma story de infra de seed E2E de templates para cobrir o ciclo de download real.

**Branches preservadas** (sem push, sem PR — `main` local ficou 20 commits à frente de
`origin/main`):

```
feat/story-159-variavel-exit-date-em-documentos      commit 9797cde  merge e577b58
feat/story-160-template-disponibilidade-por-status   commit c1bdafd  merge e0d963f
feat/story-161-barra-pdf-combinado-sempre-visivel    commit 78e6e88  merge 6dc0b66
feat/story-162-import-lote-status-ativo              commit 06ce515  merge ecacde6
```

**Reproduzir os gates:**

```
pnpm docker:up
pnpm test:setup                     # reseed ANTES da suíte adm; test:api:e2e suja o mesmo banco
pnpm build:types && pnpm build:api-client
pnpm dev:api:test                   # 3001
pnpm --filter adm.fonte dev:test    # 5174
pnpm migration:run:test             # migration da story 160
pnpm test:api && pnpm test:api:cov
pnpm test:api:e2e
pnpm test:api-client
pnpm --filter adm.fonte test:unit:cov
pnpm test:setup && pnpm test:adm    # Playwright em seed limpo
```
