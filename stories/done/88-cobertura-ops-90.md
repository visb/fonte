# Plan: Cobertura `ops.fonte` 81.4% → **90%** statements

> Filha do epic **85**. ~163 statements a cobrir (RN / jest-expo). Toca só o próprio pacote.

## Context

A story 81 levou o ops a 81.4% (1545/1898 statements; branches 70.29 / functions 82.4 / lines 83.4)
com a catraca em 80. Faltam ~163 statements para 90% — branches descobertos em hooks/components das
features e na camada compartilhada.

### Decisões travadas (herdadas do epic 85)

- TESTES-ONLY: nenhuma mudança de produção. Forms RN: `Controller` (TextInput não suporta register).
- Mock central do `@fonte/api-client` (helper `lib/test/utils.tsx` já existente) + mock do
  AsyncStorage no `jest.setup.js` — reusar.
- Catraca sobe para statements:90 (branch/fn/lines no valor atingido) ao fechar; nunca desce.
- Honestidade: manter exclusões de orquestração da 81 (rotas Expo Router `app/**`, `features/**/
  pages/**`, `_layout`). Não ampliar para inflar.

## Desenho

Medir com `pnpm test:ops:unit:cov` e fechar os maiores gaps por feature
(residents/activities/incidents/storeroom/supply-room/messages/notifications/support-groups/
census/street-sales/wishlist/ministries) + compartilhados (lib/auth, components de estado,
MessageInput, UsageTimerContext). Foco em branches de erro/estado e ramos condicionais não cobertos.

## Validação

- `pnpm test:ops:unit:cov` — **≥ 90% statements**, sem regressão de branches/functions/lines vs 81.
- Maestro nativo opcional (não-gate).

### Casos a cobrir

Estados loading/empty/error de listas/detalhes; ramos por role/permissão; branches de form
(`Controller` + zod) válido/inválido; transições de estado; timer de uso (limite/clamp/tick/
heartbeat/flush); realtime (socket) onde já testado — fechar os ramos restantes.

> **Gate de cobertura (trava a story):** todo branch novo coberto tem assert real. Rodar
> `pnpm test:ops:unit:cov`; **não reduzir** a cobertura dos módulos afetados; catraca do ops sobe
> para 90 e não desce. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Rotas/pages Expo Router (orquestração — Maestro/Playwright, já excluídas).
- Mudança de produção/contrato. Outros pacotes (cada um na sua filha).
