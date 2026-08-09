# PROGRESS — rodada 165-166 (encerrada)

Rodada aberta via `/autorun 165+166` em 2026-08-09. Protocolo: `stories/AUTORUN.md`.

## Config da rodada

- **Tema:** sessão expirada nos apps Expo (165) + cobertura e2e da aba de anexos do filho (166).
- **Ordem:** 165 → 166.
- **Branch base:** `main` (a partir de `5262852`).
- **Deps rígidas:** nenhuma. As stories são independentes; 165 veio antes só porque toca
  `packages/api-client` — o `dist/` precisa estar fresco para a suíte adm da 166.
- **Cuidados declarados:** contratos (`onUnauthorized` compatível com a assinatura sem parâmetro do
  `adm.fonte`) · nenhuma migration prevista · Postman intocado (nenhum endpoint muda nas duas) ·
  nenhuma dep externa sem credencial · cobertura ≥ 90 no escopo tocado · 166 exige a suíte adm
  inteira verde e **duas execuções seguidas sem recriar o banco**.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 165 — sessão expirada redireciona para login no ops.fonte e app.fonte | [OK] | api-client 276 · ops 604 · app 128 · adm e2e 173 | `02565d0` | `0d302e3` |
| 2 | 166 — e2e da aba de anexos do filho com fixture de templates via API | [OK] | adm e2e 178 (run 1) · adm:unit 1603 | `55412f4` | `8707e69` |

## Log

[OK] 165 — testes: api-client 276/276, ops:unit 604/604, app:unit 128/128, adm e2e 173/173;
cobertura ops 92.11 / app 92.47 / `client.ts` 100 — commit: `02565d0` — merge: `0d302e3` — 2026-08-09
— nota: `test:api-client:cov` já era vermelho na main (threshold 99% linhas vs. baseline 95.01%,
buraco em `src/modules/residents.ts`, fora do escopo); a story subiu para 95.75%.

[OK] 166 — testes: adm e2e 178/178 no run 1 (173 do baseline + 5 novos), adm:unit 1603/1603;
sem código de produto tocado — commit: `55412f4` — merge: `8707e69` — 2026-08-09 — nota: o run 2
(mesmo banco, sem reseed) deu 176/2; as 2 falhas (`bible-courses.spec.ts:149`,
`residents.spec.ts:518`) reproduzem na `main` **sem** as mudanças da story e não passam pela
fixture — ver "Dívida registrada".

## Resumo final

Rodada **concluída**: as duas stories entraram na `main` verdes, sem push e sem PR. Nada ficou
BLOQUEADO nem PENDENTE-MANUAL.

**165 — sessão expirada nos apps Expo.** `onUnauthorized` no `packages/api-client` passou a receber
`UnauthorizedContext { url, method }` e a ignorar 401 de `/auth/login` e `/auth/change-password`, de
modo que os três apps herdam a regra sem duplicá-la. `ops.fonte` e `app.fonte` ganharam a ponte
`setUnauthorizedHandler` em `lib/api.ts`, registrada pelo `AuthProvider`, que limpa AsyncStorage +
state e liga `sessionExpired` (idempotente via ref — 401 concorrentes disparam uma limpeza só). A
tela de login mostra "Sua sessão expirou. Entre novamente." e dispensa o aviso no submit. `logout()`
manual não liga a flag; `login()`/`changePassword()` a zeram. `adm.fonte` não foi alterado.

**166 — e2e da aba de anexos.** Entregável só de teste: `e2e/helpers/api.ts` (fixture de
`document_templates` via API, com `API_URL` centralizada e `deleteTemplate` tolerante a 404) e
`e2e/resident-attachments.spec.ts` (5 casos cobrindo o ciclo do PDF combinado da story 161 e o
predicado de disponibilidade por status da 160). Nenhum `data-testid` foi preciso — os seletores
estáveis já existiam. `seed-test.ts` intocado, então o gate do acolhimento
(`admissionGate.ts:21`) segue como estava para as suítes vizinhas: verificado que após as execuções
`GET /document-templates` devolve 0 templates da fixture.

### Comandos para reproduzir os gates

Pré-requisitos: `pnpm docker:up` · `pnpm test:setup` · `pnpm dev:api:test` (3001) ·
`pnpm --filter adm.fonte dev:test` (5174) · `pnpm build:types && pnpm build:api-client`.

```bash
# story 165
pnpm build:api-client
pnpm test:api-client
pnpm test:ops:unit
pnpm test:app:unit
pnpm test:adm

# story 166
pnpm test:adm          # suíte inteira, duas vezes seguidas sem reseed
pnpm test:adm:unit
```

### Branches (preservadas, sem push)

- `fix/story-165-sessao-expirada-login-mobile` → merge `0d302e3`
- `test/story-166-e2e-anexos-fixture-templates` → merge `8707e69`

### Dívida registrada (fora do escopo das duas stories, para o backlog)

1. **Suíte adm não é idempotente entre execuções sem reseed.** `bible-courses.spec.ts:149` e
   `residents.spec.ts:518` falham na segunda execução consecutiva — reproduzível na `main` limpa.
   Causa diagnosticada: `bible-courses` matricula os 3 elegíveis do seed, e `residents.spec.ts:518`
   depende de parcela pendente, mas `João Testador` entra com `entry_date = CURRENT_DATE`, então o
   carnê tem uma competência só e o caso da linha 476 já a quitou.
2. **`test:api-client:cov` vermelho na main.** Threshold do pacote é 99% de linhas; baseline 95.01%,
   agora 95.75%. O buraco é `src/modules/residents.ts` (88.27%).
