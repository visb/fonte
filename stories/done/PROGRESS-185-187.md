# PROGRESS — rodada de autorun 185–187 (encerrada)

Rodada de autorun **185–187** — aberta e encerrada em 2026-08-17.

## Config da rodada

- **Tema:** fechar os três achados da rodada 182–184 — ficha do filho hidratada sem `houseId`,
  carnê inacessível ao servo e flakiness não medida da suíte Maestro.
- **Ordem:** 185 → 186 → 187
- **Branch base:** `main` (cada branch partiu da `main` já com o merge da story anterior).
- **Deps rígidas:** 185 → 186 (as duas editam `apps/ops.fonte/e2e/product-contributions.yaml`).
  187 independente.
- **Cuidado dominante da rodada:** **sem emulador Android** (`adb devices` vazio) ⇒ toda validação
  Maestro (`pnpm test:ops`) ficou PENDENTE-MANUAL e o experimento da 187 não pôde rodar.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 185 — ficha do filho hidratada do store não nasce fresca | [x] OK | ops unit 1246/1246 | `67dee27` | `35a5756` |
| 2 | 186 — recorte do carnê para o servo | [x] OK | api 1622 + e2e 580, ops 1247, adm 1661 + 184 pw | `17f0649` | `f1c26d2` |
| 3 | 187 — diagnóstico da flakiness da suíte Maestro | [~] PARCIAL | ops unit 1308/1308 | `1b1c698` | `b63ff89` |

## Log

```
[OK] 185 — testes: ops unit 1246/1246 (111 suites), cov 94.54/85.29/93.23/95.64 (hydrate.ts 100%)
     — commit: 67dee27 — merge: 35a5756 — 2026-08-17
     PENDENTE-MANUAL: `pnpm test:ops` (Maestro) e prova do ChangeMinistryModal — sem emulador.
[OK] 186 — testes: api 1622 + e2e 580, ops unit 1247, adm 1661 + Playwright 184; cov api
     92.56/79.80/90.02/94.32 (br -0.05pp: sumiram 2 ramos 100% cobertos), ops 94.54/85.29/93.23/95.64
     — commit: 17f0649 — merge: f1c26d2 — 2026-08-17 — PENDENTE-MANUAL: Maestro (sem emulador).
[PARCIAL] 187 — testes: ops unit 1308/1308 (112 suites, +61 casos), cov 94.54/85.29/93.23/95.64
     (script fica fora do denominador, como o da 184) — commit: 1b1c698 — merge: b63ff89 — 2026-08-17
     PENDENTE-MANUAL: o experimento inteiro (10 bateladas + 3 --reverse) e o preenchimento do laudo.
```

## Resumo final

### O que passou

- **185 — hidratação da ficha (`ops.fonte`, frontend-only).** `hydrateResidentQueries` passou a
  chamar `needsServerConfirmation` na chave `residents.detail(id)`: a linha do store é a **enxuta** de
  `GET /houses/:id/residents` (sem `houseId`), e semeá-la como fresca fazia a ficha aberta nos
  primeiros 30s (`staleTime`) não rebuscar — derrubando o catálogo de produtos e escondendo o
  `ChangeMinistryModal`. O `swipe` de contorno saiu do `product-contributions.yaml`. Offline-first
  preservado: a tela abre com o dado do disco (`refetchType: 'none'` não queima tentativa sem rede).
  Prova de que o teste trava a story: com a correção desligada, os 2 casos novos de regressão falham.
- **186 — recorte do carnê para o servo.** Rota nova `GET /residents/:id/receivables/summary`
  (`ADMIN, COORDINATOR, SERVANT`) devolvendo **só** `id`/`referenceMonth`/`status`, por projeção no
  repositório. A rota cheia `GET :id/receivables` e as 4 escritas financeiras seguem
  `ADMIN/COORDINATOR`. `offline-sync` perdeu o `canSeeReceivables` e passa a descer o recorte para
  toda role de staff. `ops.fonte` consome o recorte para todas as roles; `adm.fonte` intocado.
  Postman, `BUSINESS_RULES.md` e `docs/lgpd/DIAGNOSTICO_LGPD.md` atualizados. Sonda real contra a API
  de teste: operador → 200 com exatamente três chaves.
- **187 (parcial) — bancada de medição.** `apps/ops.fonte/scripts/maestro-flakiness-run.js`
  (`--runs`, `--reverse`, `--device`), guardas importadas do `build-e2e-android.js` da 184, coleta de
  artefatos em `.maestro-flakiness/` (gitignored) e tabela por fluxo e por posição. O parser nunca
  transforma saída inesperada em verde — vira `inconclusive` com motivo. `pnpm test:ops` continua
  byte a byte `maestro test e2e/` (decisão 2), com spec que reprova quem mexer.

### O que ficou PENDENTE-MANUAL (tudo pela mesma causa: sem emulador API ≤ 34)

1. **`pnpm test:ops` (suíte Maestro, 13/13)** — pendente para as três stories. Em particular:
   `product-contributions.yaml` verde **sem o `swipe`** (aceite da 185) e **logado como operador**
   (aceite da 186), até `"Contribuição em produtos declarada."`.
2. **Prova manual do `ChangeMinistryModal`** disponível nos primeiros 30s após o login (185).
3. **O experimento da 187** — 10 bateladas na ordem normal + 3 com `--reverse` — e o preenchimento
   de `stories/187-laudo-maestro-flakiness.md` (hoje esqueleto, sem número fabricado). A story 187 só
   fecha quando o laudo estiver preenchido e movido para `stories/done/`.
4. **Validação de campo do parser da bancada** — escrito contra o formato documentado do Maestro
   2.6.x e testado com saídas sintéticas; a primeira execução real pode exigir ajuste de regex.

### Branches (locais, sem push)

- `fix/story-185-ops-offline-detalhe-pendente` → merge `35a5756`
- `feat/story-186-carne-recorte-servo` → merge `f1c26d2`
- `chore/story-187-maestro-flakiness` → merge `b63ff89`

### Reproduzir os gates

```bash
pnpm docker:up
pnpm test:setup
pnpm build:types
pnpm build:api-client
pnpm dev:api:test            # porta 3001, em outro terminal
pnpm test:api
pnpm test:api:e2e
pnpm test:api:cov
pnpm test:ops:unit
pnpm test:ops:unit:cov
pnpm test:adm:unit
pnpm --filter adm.fonte dev:test   # porta 5174, em outro terminal
pnpm test:adm
```

Pendentes, com emulador API ≤ 34 + APK de release
(`pnpm --filter ops.fonte build:e2e:android`) + `pnpm dev:ops`:

```bash
pnpm test:ops
pnpm --filter ops.fonte maestro:flakiness --runs 10 --device <serial>
pnpm --filter ops.fonte maestro:flakiness --runs 3 --reverse --device <serial>
```
