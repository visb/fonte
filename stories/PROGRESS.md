# PROGRESS — ledger ativo

Rodada de autorun **220–220** — aberta em 2026-10-20.

## Config da rodada

- **Tema:** ops — aprovar solicitação e atribuir/trocar responsável pelo coordenador da casa + aba Histórico.
- **Ordem:** 220
- **Branch base:** `main`.
- **Deps rígidas:** nenhuma.
- **Escopo técnico por story:** backend `modules/activity` (permissão, sem migration, sem endpoint novo), `BUSINESS_RULES.md`, Postman (descrições), `ops.fonte/features/activities`.
- **Cuidados da rodada:** sem migration; contratos só se `ActivityEvent` mudar (`build:types`/`build:api-client`); ops offline-first (aprovar/trocar exigem rede, não entram na outbox; allowlist offline para events seguindo `activities.detail`); ADMIN mantém comportamento no adm; Maestro exige emulador — se indisponível, PENDENTE-MANUAL; cobertura ≥90 em `modules/activity` e `features/activities`.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 220 — aprovar solicitação e responsável no ops | [ ] | | | |

## Log

## Resumo final

<vazio até o fim da rodada>
