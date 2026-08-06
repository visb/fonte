# PROGRESS — rodada 158 (encerrada)

Rodada: **158 — sidebar do adm.fonte com scroll próprio**. Encerrada em 2026-08-06.

## Config da rodada

- **Tema:** layout do `adm.fonte` — sidebar com scroll interno, header/footer fixos.
- **Ordem:** 158.
- **Branch base:** `main` (`6c066b4`).
- **Deps rígidas:** nenhuma (story única).
- **Cuidados:** escopo de arquivo único (`AppLayout.tsx`, só classes Tailwind); sem migration, sem
  mudança de contrato (`packages/types` / `api-client`), sem alteração no Postman; gate de
  cobertura ≥ 90 no escopo tocado.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 158 — sidebar do adm.fonte com scroll próprio | [OK] | unit 1468/1468 · e2e 170/170 | `0ecb18f` | `b935548` |

## Log

```
[OK] 158 — testes: adm unit 1468/1468 (213 arquivos), Playwright 170/170 (5 novos em layout.spec.ts),
build adm sem erro de tipo, cobertura 92.92% stmts (thresholds do pacote 90/85/83/90 OK)
— commit: 0ecb18f — merge: b935548 — 2026-08-06 — sem bloqueio.
Nota: AppLayout.tsx segue em coverage.exclude do vitest.config.ts (decisão da story 80 — shell
coberto por E2E); o unit novo roda e passa, mas não entra no denominador.
```

## Resumo final

**Passou:** a story única da rodada (158). `AppLayout.tsx` ganhou `min-h-0 overflow-y-auto` na
`<nav>` e `shrink-0` no header e no rodapé da sidebar — a lista de links rola sozinha e
**Meu Perfil** / **Sair** ficam sempre visíveis, em desktop e mobile. Nenhuma mudança de estrutura,
rota, estado ou comportamento de submenu.

**Testes novos:** `apps/adm.fonte/src/components/layout/AppLayout.test.tsx` (Vitest + RTL, 8 casos)
e `apps/adm.fonte/e2e/layout.spec.ts` (Playwright, 5 casos). Contra-prova feita: sem a mudança de
produção, 4/5 casos do e2e falham — o spec não é vacuous.

**BLOQUEADO / PENDENTE-MANUAL:** nada.

**Branches e commits:**
- branch `fix/story-158-sidebar-scroll-independente` (preservada, sem push)
- `0ecb18f` — `fix(story-158): sidebar do adm.fonte com scroll proprio`
- `b935548` — `merge: story 158 — sidebar do adm.fonte com scroll proprio`
- `77a5b9a` — `docs(stories): arquiva story 158 concluida em done/`

**Reproduzir os gates:**

```bash
pnpm docker:up
pnpm test:setup
pnpm build:types && pnpm build:api-client
pnpm dev:api:test                      # terminal 2 — porta 3001
pnpm --filter adm.fonte dev:test       # terminal 3 — porta 5174

pnpm test:adm:unit
pnpm test:adm
pnpm --filter adm.fonte build
```

**Serviços:** deixados de pé (postgres/redis, API teste em 3001, adm teste em 5174).
