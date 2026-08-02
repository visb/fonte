# PROGRESS — rodada 155-156 (encerrada em 2026-08-02)

Rodada de autorun: **fixes de suíte (testes acoplados a data e a ambiente)**. Ambas as stories
concluídas e mergeadas na `main` local. Sem push, sem PR.

## Config da rodada

- **Tema:** eliminar duas falhas de suíte que não eram regressão de código — teste com data fixa
  (bomba-relógio) e teste que assumia o `.env` da máquina.
- **Ordem executada:** `156` → `155`.
- **Branch base:** `main` (`261d310`).
- **Deps rígidas:** nenhuma; arquivos disjuntos.
- **Cuidados aplicados:** ambas test-only (nada em `src/`); sem migration; sem mudança de contrato ⇒
  `fonte-api.postman_collection.json` intocado; `.env` local aponta para produção e `clear-bucket` é
  destrutivo, então nenhum teste executou `main()`/`run({argv:['--yes']})` contra env real.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 156 — isolar `clear-bucket.spec` do ambiente | [OK] | unit 1299/1299 · spec 8→9 | `89942d7` | `c53881c` |
| 2 | 155 — datas relativas nos e2e de eventos | [OK] | e2e 496/496 · unit 1299/1299 | `3e4ba3d` | `c665e4b` |

## Log

```
[OK] 156 — testes: api 1299/1299 (119 suites), clear-bucket.spec 8/8→9/9; cobertura global inalterada (91.7/77.92/88.8/93.61) — commit: 89942d7 — merge: c53881c — 2026-08-02
Prova de isolamento verde: `pnpm test:api` completo com e sem vars S3 no ambiente deu resultado idêntico.
```

```
[OK] 155 — testes: e2e 495/496 → 496/496 (33 suites); suíte de eventos 70/71 → 71/71; unit 1299/1299 inalterado — commit: 3e4ba3d — merge: c665e4b — 2026-08-02
Prova anti-regressão verde com relógio deslocado +400d e +1500d; contraprova nos specs originais falha, provando que o harness é sensível.
```

## Resumo final

### O que passou

- **156** — `src/database/clear-bucket.spec.ts` passou a construir o ambiente que testa
  (`beforeEach` salva `process.env`, `afterEach` restaura) e ganhou o caso "modo S3" que antes só
  acontecia por acidente na máquina de quem tinha credenciais. O comentário mentiroso foi corrigido.
  `src/database/clear-bucket.ts` e o `StorageService` ficaram intactos, como decidido no plano.
  Chaves que decidem o modo, levantadas do service: `AWS_S3_BUCKET_NAME` + `AWS_ENDPOINT_URL`
  (`AWS_DEFAULT_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` entram no `S3Client` e são
  limpas junto). Valores fabricados: `test-bucket` / `https://s3.invalid`. Nenhum segredo lido ou
  commitado.
- **155** — helper compartilhado `test/helpers/dates.ts` (`daysFromNow`), adotado nos três specs de
  eventos; `validBody()` usa `daysFromNow(30)`; o par upcoming/past passou a usar offsets de sinais
  opostos com âncoras próprias; a asserção de ordenação ficou mais forte (antes comparava a lista com
  ela mesma ordenada e passaria com todos os eventos na mesma data). O `expect.stringContaining('/2026')`
  do spec de convite — que viraria a próxima bomba — foi trocado pela data do próprio `startAt`
  formatada em pt-BR/América-São_Paulo.

### Comandos exatos para reproduzir os gates

```bash
pnpm docker:up
pnpm test:setup
pnpm build:types && pnpm build:api-client
pnpm dev:api:test              # porta 3001, terminal separado

pnpm test:api                  # 1299/1299, 119 suites
pnpm test:api:cov              # All files 91.7 / 77.92 / 88.8 / 93.61
pnpm test:api:e2e              # 496/496, 33 suites
```

### BLOQUEADO / PENDENTE-MANUAL

Nenhum.

### Branches (preservadas, sem push)

- `fix/story-156-clear-bucket-spec-isolado` → merge `c53881c`
- `fix/story-155-e2e-eventos-datas-relativas` → merge `c665e4b`

### Insumo para stories futuras (relatado, não corrigido)

1. **Herança de env nos e2e de pagamento** — `test/events-payment.e2e-spec.ts:4-5` e
   `test/associates-payment.e2e-spec.ts:4-5` fazem
   `process.env.PAGARME_WEBHOOK_USER = process.env.PAGARME_WEBHOOK_USER ?? 'hookuser'`, herdando o
   valor da máquina. Mesma família do defeito da 156. Todos os e2e mutam `process.env` em escopo de
   módulo sem restaurar.
2. **Datas fixas em e2e fora de eventos** (maior risco primeiro):
   - `test/bible-courses.e2e-spec.ts` — janelas de turma `2026-06-01`/`2026-09-01` (linhas 54, 161,
     295, 388) e `exitDate: '2026-01-01'` (612). Passam hoje porque nenhuma rota exercida filtra por
     turma vigente; a partir de 2026-09 são turmas encerradas. Os `entryDate: '2020-01-01'` são
     seguros de propósito (alimentam o filtro de meses do `bible-course.service.ts:276`).
   - `test/storerooms.e2e-spec.ts` e `test/supply-room.e2e-spec.ts` — `2026-05-15..17`, inertes
     hoje; viram bomba se alguém cobrir a consolidação semanal sem passar `referenceDate`.
   - `test/street-sale.e2e-spec.ts:337` — comentário desatualizado descrevendo um acoplamento a
     `now()` que não existe mais; engana quem for depurar.
   - Inertes, sem ação: `payables`, `support-groups`, `incidents`, `residents`, `resident-import*`,
     `resident-receivable`.
3. **`src/common/guards/login-throttler.guard.ts:9`** lê `process.env.NODE_ENV` e hoje não tem spec —
   um futuro teste precisa definir `NODE_ENV` explicitamente para não repetir o defeito da 156.
4. **`clear-bucket.ts:1`** faz `import "dotenv/config"`: importar aquele spec carrega o `.env` real
   dentro do processo do Jest. Inócuo agora que o spec controla as chaves sobre as quais afirma, mas
   é o único ponto onde a suíte unitária puxa o `.env` da máquina.
