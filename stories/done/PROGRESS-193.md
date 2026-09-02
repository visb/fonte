# PROGRESS — rodada 193 (encerrada)

Rodada de autorun **193** — aberta em 2026-09-01, encerrada em 2026-09-01.

## Config da rodada

- **Tema:** recibo da contribuição mensal do filho — segundo tipo de recibo (`RESIDENT_CONTRIBUTION`)
  e entrega ao familiar no `app.fonte`.
- **Ordem:** 193 (rodada de story única).
- **Branch base:** `main`.
- **Deps rígidas:** nenhuma — a story 178 (estrutura de recibos) já estava na `main`.
- **Cuidados:** nenhuma migration (decisão 4), contratos `types`/`api-client` rebuildados, Postman
  atualizado, regressão da 178 sem mudar expectativa, fixtures e2e no padrão da story 182,
  cobertura ≥ 90 no escopo tocado.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 193 — recibo da contribuição mensal do filho | [OK] | api 1790/1790 · e2e 613/613 · adm unit 1729/1729 · adm e2e 189 · app unit 167/167 · api-client 306/306 | `63bbd77` | `6619aa4` |

## Log

```
[OK] 193 — testes: api 1790/1790, api:e2e 613/613, api-client 306/306, adm:unit 1729/1729,
     adm e2e 189 passed (1 flaky pré-existente da 192), app:unit 167/167; cobertura receipt
     100% e feature contributions 100%; zero migration nova — commit: 63bbd77 — merge: 6619aa4 — 2026-09-01
     PENDENTE-MANUAL: pnpm test:app (Maestro) não executado — nenhum emulador/aparelho conectado.
```

## Resumo final

**Entregue.** O segundo tipo de recibo (`RESIDENT_CONTRIBUTION`) entrou sobre a estrutura da story
178 com **um resolver e nenhuma migration** — que era a aposta estrutural em teste. Escopo do
familiar validado de ponta a ponta: parcela de outro filho devolve **404** e **não** consome número
de sequência (checagem antes de `allocateNumber`, provado em unit e e2e).

- **Backend:** `resident-contribution-receipt.resolver.ts`, `ReceiptService.generateForResidentReceivable`,
  `RECEIPT_FILENAME_PREFIX` estendido, `RelativeService.findMyPaidReceivables`,
  `ResidentReceivableService.findPaidByResident`; rotas
  `GET /residents/:id/receivables/:receivableId/receipt` (ADMIN/COORDINATOR),
  `GET /relatives/me/receivables` e `GET /relatives/me/receivables/:id/receipt` (RELATIVE, com `@Audit`).
- **Contratos:** `packages/types` (enums, `IMPLEMENTED_RECEIPT_TYPES`, `RECEIPT_TYPE_LABELS`,
  `RelativePaidReceivable`, `PAYMENT_METHOD_LABELS`/`FAMILY_INVESTMENT_LABELS` movidos do `adm.fonte`,
  que passou a reexportar) e `packages/api-client` (3 métodos novos, `responseType` parametrizável).
- **adm.fonte:** botão de recibo em `ReceivableRow` (só `PAID`, também em acolhimento encerrado —
  leitura não é escrita), `useReceivableReceipt`, `triggerDownload` extraído para `lib/download.ts`,
  `RECEIPT_VARIABLES_BY_TYPE`.
- **app.fonte:** feature `contributions/` + rota + aba no menu; download `arraybuffer` → base64 →
  `FileSystem.cacheDirectory` → `Sharing.shareAsync`; `expo-file-system`/`expo-sharing` nas versões
  do `ops.fonte`.
- **Postman** atualizado com as 3 rotas.

**Reproduzir os gates:** `pnpm build:types` · `pnpm build:api-client` ·
`pnpm --filter api migration:run:test` · `pnpm test:api` · `pnpm test:api:e2e` · `pnpm test:api:cov` ·
`pnpm test:api-client` · `pnpm test:adm:unit` · `pnpm test:adm` · `pnpm test:app:unit`.

**PENDENTE-MANUAL:** `pnpm test:app` (Maestro). O flow `apps/app.fonte/e2e/contributions.yaml` foi
escrito mas não executado — `adb devices` vazio, sem emulador/aparelho. Rodar com AVD API ≤ 34 e o
Metro do `app.fonte` de pé.

**Achados fora do escopo (não corrigidos aqui):**

1. `apps/adm.fonte/e2e/residents.spec.ts` cria filhos pelo wizard e **não os remove** — depois de
   várias baterias o banco chegou a 64 filhos ativos e o seed "João Testador" saiu da primeira
   página, derrubando testes de `residents.spec`/`resident-attachments.spec`. É buraco de isolamento
   pela regra da story 182 e vai voltar a doer.
2. `observability.spec.ts › Zerar contadores...` (story 192) é flaky em bateria completa (contadores
   in-memory compartilhados); verde isolado.
3. `docs/comunicacao/whatsapp-coordenadores-nova-plataforma.md` estava modificado no working tree
   antes da rodada e foi deixado **fora** do stage — segue não commitado.
