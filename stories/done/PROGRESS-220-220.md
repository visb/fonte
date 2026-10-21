# PROGRESS — rodada 220–220

Rodada de autorun **220–220** — aberta em 2026-10-20, encerrada em 2026-10-20.

## Config da rodada

- **Tema:** ops — aprovar solicitação e atribuir/trocar responsável pelo coordenador da casa + aba Histórico.
- **Ordem:** 220
- **Branch base:** `main`.
- **Deps rígidas:** nenhuma.
- **Escopo técnico por story:** backend `modules/activity` (permissão, sem migration, sem endpoint novo), `BUSINESS_RULES.md`, Postman (descrições), `ops.fonte/features/activities`.
- **Cuidados da rodada:** sem migration; contratos só se `ActivityEvent` mudar; ops offline-first (aprovar/trocar exigem rede, fora da outbox); ADMIN mantém comportamento no adm; Maestro exige emulador; cobertura ≥90 em `modules/activity` e `features/activities`.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 220 — aprovar solicitação e responsável no ops | [OK] | api 2361 · e2e 757 · ops 1710 · web 3 | 0336d27 | 91cf673 |

## Log

[OK] 220 — testes: api 2361/2361, api:e2e 757/757, ops unit 1710/1710, Playwright web 3/3; cobertura activity 96/86.6/95.3/98.2, ops activities 95.2/87.3/94.1/96.2 — commit: 0336d27 — merge: 91cf673 — 2026-10-20
PENDENTE-MANUAL: Maestro `e2e/activities.yaml` (sem emulador). Nota: corrigido bug pré-existente — PATCH de responsável já existente não persistia (relação `responsible` sobrescrevia FK).

## Resumo final

- **Passou:** 220, mergeada na `main` (`91cf673`), branch `feat/story-220-ops-aprovar-solicitacao-e-responsavel` preservada. Sem push.
- **PENDENTE-MANUAL:** `pnpm test:ops` (Maestro) — exige emulador API ≤34 + APK e2e (`pnpm --filter ops.fonte build:e2e:android`).
- **Edição paralela fora da story** (troca "Impedir" → "Marcar Impedimento" + aspas duplas em 4 arquivos de activities do adm/ops) não foi commitada: stash antes do merge, versão commitada validada isolada (ops activities+offline 43 suítes/564 testes verde), restaurada na working tree após o merge.
- **Reproduzir gates:** `pnpm test:api` · `pnpm test:api:e2e` (com `pnpm dev:api:test`) · `pnpm --filter ops.fonte test:unit` · `pnpm test:api:cov`.
