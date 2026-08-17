# PROGRESS — ledger ativo

Rodada de autorun **182–184** — aberta em 2026-08-17.

## Config da rodada

- **Tema:** e2e do monorepo verde e reproduzível — suítes idempotentes (fixture por suíte) e a suíte
  Maestro do `ops.fonte` rodável num clone limpo, fechando 13/13.
- **Ordem:** 182 → 184 → 183 (a 183 declara a 184 como pré-requisito de execução Maestro; a faixa
  pedida foi "182 em diante", a ordem numérica foi invertida só nesse par).
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:** 184 → 183. A 183 só pode ser **validada** em Maestro depois que o build
  reproduzível (cleartext condicional, guarda de API level, ABI do device) existir. Se a 184 bloquear,
  a 183 fica bloqueada junto na parte Maestro (o gate unit dela é independente e ainda roda).
- **Escopo técnico por story:**
  - **182** — só código de teste/infra de fixture: `services/api/test/storerooms.e2e-spec.ts`,
    `services/api/test/supply-room.e2e-spec.ts`, `apps/adm.fonte/e2e/helpers/api.ts`,
    `apps/adm.fonte/e2e/residents.spec.ts`, catraca nova
    `services/api/test/e2e-cleanup-scope.spec.ts` (unit), `CLAUDE.md`. **Sem** migration, **sem**
    `packages/types`/`api-client`, **sem** Postman.
  - **184** — `apps/ops.fonte/app.json` → `app.config.js` (cleartext condicional a
    `EXPO_PUBLIC_API_URL` começar com `http://`), `apps/ops.fonte/scripts/build-e2e-android.js` +
    script `build:e2e:android`, unit dos ramos puros, `CLAUDE.md` e
    `.claude/skills/fonte-frontend`. Sem backend, sem contrato, sem Postman.
  - **183** — `accessibilityLabel` nas linhas do dropdown de
    `features/storeroom/components/ItemSearchInput.tsx` e do espelho em `features/supply-room/`,
    `e2e/storeroom.yaml` (esperar a linha do dropdown), `e2e/product-contributions.yaml` (trocar
    João Testador por Marcelo Reacolhido), unit dos dois componentes. Sem backend, sem seed, sem
    Postman.
- **Cuidados da rodada:**
  - **Nenhuma migration nova.** Nenhuma das três toca schema; migration nesta rodada é sinal de
    escopo vazando.
  - **Gate de cobertura ≥ 90 no pacote tocado:** 182 → `pnpm test:api:cov` sem reduzir
    `services/api`; 183 e 184 → `pnpm test:ops:unit:cov` sem reduzir `ops.fonte`.
  - **A prova da 182 é ordem-independência**, não só verde: `test:api:e2e` duas vezes sem reseed, e
    `test:adm` → `test:api:e2e` (a ordem que hoje derruba). Um único run verde não fecha a story.
  - **Maestro é dependência de ambiente externo:** exige emulador/aparelho API ≤ 34 + Metro +
    API de teste. Sem device conectado, a parte Maestro de 183/184 vira **PENDENTE-MANUAL** (com os
    gates unit verdes e o script/config entregues) — não inventar resultado de suíte em aparelho.
  - **`ops.fonte` é offline-first (invariante do CLAUDE.md).** As mudanças de 183/184 são de label e
    de config de build; nada de mexer em `networkMode`, `onlineManager` ou fila offline de passagem.
  - **`app.json` removido na 184** — o Expo não pode ver `app.json` e `app.config.js` juntos.
    Conferir a config resolvida antes/depois: única diferença aceitável é `usesCleartextTraffic`
    (em especial `newArchEnabled: false` não pode desaparecer).
  - **`seed-test.ts` não muda em nenhuma das três** (rejeitado na decisão 2 da 183 e na 7 da 182).
  - **Ambiente desta máquina (2026-08-17):** dois emuladores conectados (`emulator-5554`,
    `emulator-5556`). `adb shell getprop` sem `-s <serial>` falha com "more than one device" — o
    script da 184 tem que escolher/exigir o alvo explicitamente, não assumir device único.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 182 — suítes e2e idempotentes (fixture por suíte + catraca) | [ ] | | | |
| 2 | 184 — ops.fonte: build/ambiente de e2e reproduzíveis | [ ] | | | |
| 3 | 183 — ops.fonte: dispensa e contribuição em produtos verdes (13/13) | [ ] | | | |

## Log

```
(vazio — primeira entrada ao fechar a story 182)
```

## Resumo final

<vazio até o fim da rodada>
