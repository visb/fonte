# PROGRESS — rodada 157 (encerrada)

## Config da rodada

- **Tema:** variável `{{residentPhoto}}` — foto do filho nos documentos gerados.
- **Stories:** 157 (rodada de uma story só).
- **Branch base:** `main` (`af5a49e` → ledger em `2e95706`).
- **Deps rígidas:** nenhuma.
- **Cuidados declarados:** sem migration/endpoint/contrato (Postman intocado); refatoração de código
  já testado nos dois lados (`replaceBlockToken` no backend, fábrica `createTokenPlaceholder` no
  adm) com os specs de assinatura das stories 128/135/136/137/141 rodando **inalterados** como
  critério; foto nunca bloqueia a geração; modo local exige `toDataUri` (story 135); gate ≥90.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 157 — variável `{{residentPhoto}}` nos documentos | [OK] | api 1315 · api-e2e 498 · adm-unit 1460 · adm-e2e 165 | `f8440d0` | `028dea9` |

## Log

- [OK] 157 — testes: api 119 suítes/1315, api-e2e 33/498, adm unit 212 arquivos/1460, adm e2e
  165/165; cobertura `document-template.service.ts` 96% stmts / 90.4% branch, adm tocados 100%
  (`tokenPlaceholder.ts` 96% branch) — commit: `f8440d0` — merge: `028dea9` — 2026-08-02.
- Nota: o `fonte-implementer` morreu no limite de sessão **depois** de commitar, sem rodar os gates;
  os gates foram rodados pelo orquestrador. `residents.spec.ts:518` falhou na 1ª passada da suíte
  adm — poluição do banco de teste pelo `test:api:e2e` (mesmo DB), não regressão: passou após
  `pnpm test:setup` e a suíte inteira fechou 165/165 em seed limpo.

## Resumo final

**Entregue.** `{{residentPhoto}}` é a segunda variável de bloco do sistema: imprime a foto do
acolhido em 151×151px (~4×4 cm, `object-fit:cover`) ou, sem foto, uma moldura vazia rotulada `Foto`
para colar à mão — nunca bloqueia a geração. Vale no preview HTML, no PDF individual e no PDF
combinado, porque entra pelo `renderForResident`.

Refatorações que a story trouxe junto, ambas validadas pelos testes de assinatura preexistentes
rodando sem alteração:

- backend: mecanismo de token-de-bloco extraído em `replaceBlockToken` (`SIG_WRAP` → `TOKEN_WRAP`),
  antes exclusivo do `{{signature}}`;
- adm: `SignaturePlaceholder` generalizado na fábrica `createTokenPlaceholder`
  (`tokenPlaceholder.ts`), com exports e atributos DOM preservados; `ResidentPhotoPlaceholder` é a
  segunda instância.

Nada BLOQUEADO, nada PENDENTE-MANUAL. Sem push e sem PR — `main` local ficou **15 commits à frente**
de `origin/main`.

**Reproduzir os gates:**

```
pnpm docker:up
pnpm test:setup          # reseed ANTES da suíte adm; test:api:e2e suja o mesmo banco
pnpm build:types && pnpm build:api-client
pnpm dev:api:test        # 3001
pnpm --filter adm.fonte dev:test   # 5174
pnpm test:api && pnpm test:api:cov
pnpm test:api:e2e
pnpm --filter adm.fonte test:unit:cov
pnpm test:setup && pnpm test:adm   # Playwright em seed limpo
```

Branch preservada: `feat/story-157-variavel-foto-do-filho-em-documentos`.
