# PROGRESS — ledger ativo

Rodada aberta: **155-156 — fixes de suíte (testes acoplados a data e a ambiente)**.
Rodadas encerradas são arquivadas em `stories/done/PROGRESS-NN-MM.md`.

## Config da rodada

- **Tema:** eliminar duas falhas de suíte que não são regressão de código — teste com data fixa
  (bomba-relógio) e teste que assume o `.env` da máquina.
- **Ordem:** `156` → `155`.
  - 156 primeiro por ser unit puro (não exige API de teste de pé) e por destravar a leitura da
    suíte `pnpm test:api` antes do e2e.
- **Branch base:** `main` (limpa, `261d310`).
- **Deps rígidas:** nenhuma. As duas stories tocam arquivos disjuntos
  (`src/database/clear-bucket.spec.ts` vs `test/events*.e2e-spec.ts`); se uma bloquear, a outra segue.
- **Cuidados da rodada:**
  - **Ambas são test-only.** Nada em `src/` (produção) muda. Se a cobertura de `src/` se mover,
    algo saiu do escopo.
  - **Sem migration, sem mudança de contrato** (`packages/types` / `api-client` intactos) ⇒
    **sem alteração no `fonte-api.postman_collection.json`**.
  - ⚠️ **Segurança (156):** o `.env` local do api aponta para **produção** (banco e bucket) e o
    `clear-bucket` é destrutivo. Nunca executar `main()` / `run({ argv: ['--yes'] })` contra
    `process.env` real; todo teste injeta `storage`/`bucketName` fabricados. Valores S3 do novo caso
    devem ser obviamente falsos (`test-bucket`, `https://s3.invalid`) — nunca copiar credencial real,
    nunca commitar segredo.
  - **156** precisa restaurar `process.env` no `afterEach` — validar rodando o spec **junto da suíte
    completa**, não só isolado, para provar que não vaza ambiente para os vizinhos.
  - **155** exige prova anti-regressão explícita: rodar a suíte de eventos com o offset base
    deslocado (ou relógio adiantado) e continuar verde — senão a bomba-relógio só foi reagendada.
  - Varreduras pedidas pelas duas stories (outros e2e com literal de data; outros specs acoplados a
    `process.env`) são **para relatar**, não para corrigir — insumo de story futura.
  - **Gate de cobertura ≥ 90 no escopo tocado**; sem `skip`/`only`/`xfail` sem justificativa.
- **Pré-requisitos de serviço:** `pnpm docker:up`, `pnpm test:setup`,
  `pnpm build:types && pnpm build:api-client`, `pnpm dev:api:test` (3001) para o e2e da 155.
  `adm dev:test` (5174) **não** é necessário — nenhuma story toca Playwright.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 156 — isolar `clear-bucket.spec` do ambiente | [ ] | — | — | — |
| 2 | 155 — datas relativas nos e2e de eventos | [ ] | — | — | — |

## Log

<vazio>

## Resumo final

<vazio>
