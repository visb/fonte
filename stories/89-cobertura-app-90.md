# Plan: Cobertura `app.fonte` 83.77% → **90%** statements

> Filha do epic **85**. Gap pequeno: ~21 statements (RN / jest-expo). Toca só o próprio pacote.

## Context

A story 84 levou o app a 83.77% (284/339 statements; branches 76.65 / functions 82.57 / lines 86.49)
com a catraca em 80. Faltam ~21 statements para 90% — ramos pontuais em hooks/components.

### Decisões travadas (herdadas do epic 85)

- TESTES-ONLY: nenhuma mudança de produção. Forms RN: `Controller`.
- Mock central do `@fonte/api-client` (helper `lib/test/utils.tsx`) + AsyncStorage mock — reusar.
- Catraca sobe para statements:90 (branch/fn/lines no valor atingido) ao fechar; nunca desce.
- Honestidade: manter exclusões da 84 (rotas `app/**`, `features/**/pages/**`, `lib/test/**`).

## Desenho

Medir com `pnpm test:app:unit:cov` e fechar os ~21 statements restantes: branches de erro/estado em
checkin (`useSupportGroupCheckin`), wishlist, messages (hooks + components MessageBubble/
AttachmentMenu/RecordingBar/AudioPlayer/MessageInput), auth (`AuthProvider`/forms), profile,
privacy (consents). Provavelmente ramos de erro de mutation e variações de estado já quase cobertos.

> O ciclo de press do envio de áudio (onPressIn/onPressOut) seguiu para E2E Maestro na 84 (instável
> no jsdom) — se algum statement residual for desse caminho, mantê-lo justificado, não forçar.

## Validação

- `pnpm test:app:unit:cov` — **≥ 90% statements**, sem regressão de branches/functions/lines vs 84.
- Maestro nativo opcional (não-gate).

### Casos a cobrir

Estados error/empty de hooks; ramos de mutation falha; branches condicionais de form
(`Controller` + zod) e de render dos components de mensagem/anexo; grant/revoke de consentimento.

> **Gate de cobertura (trava a story):** todo branch novo coberto tem assert real. Rodar
> `pnpm test:app:unit:cov`; **não reduzir** a cobertura dos módulos afetados; catraca do app sobe
> para 90 e não desce. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Rotas/pages Expo Router (orquestração — já excluídas).
- Envio de áudio fim-a-fim (E2E Maestro). Mudança de produção. Outros pacotes (cada um na sua filha).
