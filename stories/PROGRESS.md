# PROGRESS — ledger ativo

Rodada de autorun **193** — aberta em 2026-09-01.

## Config da rodada

- **Tema:** recibo da contribuição mensal do filho — segundo tipo de recibo (`RESIDENT_CONTRIBUTION`)
  e entrega ao familiar no `app.fonte`.
- **Ordem:** 193 (rodada de story única).
- **Branch base:** `main`.
- **Deps rígidas:** nenhuma — a story 178 (estrutura de recibos) já está na `main`.
- **Escopo técnico:** `packages/types` (enums `ReceiptType`/`ReceiptSubjectType`,
  `IMPLEMENTED_RECEIPT_TYPES`, `RECEIPT_TYPE_LABELS`, `PAYMENT_METHOD_LABELS` movido do `adm.fonte`),
  `services/api` (resolver novo + `ReceiptService.generateForResidentReceivable` + 3 rotas),
  `packages/api-client` (`residents.receivableReceipt`, `relatives.myPaidReceivables`,
  `relatives.receivableReceipt`), `adm.fonte` (`ReceivableRow`, `useReceivableReceipt`,
  `RECEIPT_VARIABLES_BY_TYPE`), `app.fonte` (feature `contributions` + rota + expo-file-system/sharing),
  `fonte-api.postman_collection.json`.
- **Cuidados da rodada:**
  - **Nenhuma migration** (decisão 4 da story). Migration nesta story = desenho errado;
    `pnpm migration:run:test` verde sem migration nova no diff.
  - Contratos: rodar `pnpm build:types` e `pnpm build:api-client` antes das suítes de front.
  - Postman atualizado com as 3 rotas novas (regra do CLAUDE.md).
  - Regressão do recibo do associado (178): specs existentes passam **sem** mudar expectativa.
  - Fixtures e2e no padrão da story 182 (criadas pela suíte, limpeza por id acumulado; nunca
    `DELETE FROM issued_receipts`).
  - Gate de cobertura ≥ 90 no escopo tocado (`receipt`, `document-template`, features
    `residents`/`settings` do `adm.fonte`, feature nova do `app.fonte`).
  - Sem dependência externa com credencial nesta rodada.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 193 — recibo da contribuição mensal do filho | [ ] | | | |

## Log

```
```

## Resumo final

<vazio até o fim da rodada>
