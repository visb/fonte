# PROGRESS — rodada de autorun 182–184 (encerrada)

Rodada de autorun **182–184** — aberta e encerrada em 2026-08-17.

## Config da rodada

- **Tema:** e2e do monorepo verde e reproduzível — suítes idempotentes (fixture por suíte) e a suíte
  Maestro do `ops.fonte` rodável num clone limpo, fechando 13/13.
- **Ordem:** 182 → 184 → 183 (a 183 declara a 184 como pré-requisito de execução Maestro; a faixa
  pedida foi "182 em diante", a ordem numérica foi invertida só nesse par).
- **Branch base:** `main` (cada branch partiu da `main` já com o merge da story anterior).
- **Deps rígidas:** 184 → 183 (build reproduzível antes da validação Maestro). Respeitada.
- **Cuidados da rodada:** nenhuma migration; gate de cobertura ≥ 90 no pacote tocado; prova de
  ordem-independência na 182; Maestro como dependência de ambiente externo; `ops.fonte` offline-first
  intocado; `app.json` removido na 184 sem perder `newArchEnabled: false`; `seed-test.ts` inalterado
  nas três. Ambiente: dois emuladores (`emulator-5554` API 37 — inútil para Maestro; `emulator-5556`
  API 34 — o alvo).

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 182 — suítes e2e idempotentes (fixture por suíte + catraca) | [OK] | api 1609 · e2e 566 2x · adm 184 2x | `e391a3f` | `a8e9812` |
| 2 | 184 — ops.fonte: build/ambiente de e2e reproduzíveis | [OK] | ops:unit 1233 (+47) | `19e8934` | `9335606` |
| 3 | 183 — ops.fonte: dispensa e contribuição em produtos verdes (13/13) | [OK] | ops:unit 1242 (+9) · maestro 13/13 | `a342b5f` | `a9bf7a1` |

## Log

```
[OK] 182 — testes: api 1609/1609 (132 suítes, +12 da catraca) · api:e2e 566/566 duas vezes sem
     reseed · adm 184/184 duas vezes · prova de ordem adm→api:e2e verde · cov services/api
     92.55/79.85/90/94.32 inalterada — commit: e391a3f — merge: a8e9812 — 2026-08-17
     Nota: jest unit do api ganhou `roots` com `test/` para a catraca rodar em test:api (testRegex
     não casa *.e2e-spec.ts, então nenhum e2e entrou no unit).
[OK] 184 — testes: ops:unit 1233/1233 (111 suítes, +47) · cov ops.fonte 94.5/85.2/93.15/95.6
     inalterada · config resolvida antes/depois difere só em usesCleartextTraffic · manifest e
     build de release provados em aparelho (emulator-5556, API 34) — commit: 19e8934 —
     merge: 9335606 — 2026-08-17
     PENDENTE-MANUAL na hora: `pnpm test:ops` (13/13) confirmado depois, pela 183.
[OK] 183 — testes: ops:unit 1242/1242 (+9) · maestro 13/13 em 8m31s no emulator-5556 (APK release
     rebuildado e reinstalado) · cov features/storeroom 96.12/89.47/94/95.88, features/supply-room
     95.18/87.78/93.33/95.12, features/residents 92.88/89.69/91.03/93.14 — todas inalteradas —
     commit: a342b5f — merge: a9bf7a1 — 2026-08-17
     Três desvios do plano forçados por defeito revelado em aparelho (ver Resumo final).
```

## Resumo final

**Todas as três stories fecharam [OK] e verdes. Nenhuma BLOQUEADA. Nada pendente de credencial.**

### O que passou

- **182** — as suítes e2e são idempotentes. A limpeza de `storerooms.e2e-spec.ts` e
  `supply-room.e2e-spec.ts` passou de "por categoria" (`WHERE kind = ...`, que levava o "Arroz (kg)"
  do seed) para "por autoria" (ids acumulados, `= ANY($1)`, contribuições → movimentos → itens). Os
  dois testes de Contribuição do `adm.fonte` ganharam filho e item de catálogo próprios, criados via
  API (`e2e/helpers/api.ts`), então ninguém mais queima o carnê do João Testador. Catraca nova
  `services/api/test/e2e-cleanup-scope.spec.ts` (12 testes) deriva as tabelas semeadas do
  `seed-test.ts` e reprova `DELETE` sem `WHERE` parametrizado nelas — inclui um teste que falha se a
  varredura ler menos de 20 arquivos, para a catraca não passar varrendo nada.
- **184** — `app.json` → `app.config.js` com `usesCleartextTraffic` condicional a
  `EXPO_PUBLIC_API_URL` começar com `http://` (produção fala https ⇒ cleartext segue bloqueado).
  `scripts/build-e2e-android.js` + `pnpm --filter ops.fonte build:e2e:android` fazem prebuild +
  `assembleRelease` com a ABI do device, exigem serial quando há mais de um aparelho e **abortam
  acima de API 34** citando o AVD a criar. `CLAUDE.md` e `.claude/skills/fonte-frontend` passaram a
  ligar os três sintomas enganosos às causas.
- **183** — o dropdown de item (dispensa, almoxarifado e o `CatalogProductPicker` da declaração)
  ganhou `accessibilityLabel={`Selecionar <nome>`}`, e os dois yaml passaram a esperar e tocar a
  linha, em vez de acertar o próprio `TextInput`. `product-contributions.yaml` trocou para o
  **Marcelo Reacolhido** (o único filho do seed que nasce com `family_investment`). Suíte Maestro
  fechou **13/13**.

### Reproduzir os gates

```bash
pnpm docker:up
pnpm test:setup
pnpm build:types
pnpm build:api-client
pnpm dev:api:test                      # terminal próprio, porta 3001
pnpm --filter adm.fonte dev:test       # terminal próprio, porta 5174

pnpm test:api                          # 1609/1609 — inclui a catraca
pnpm test:api:e2e                      # 566/566 — rodar 2x sem reseed
pnpm test:adm                          # 184/184 — rodar 2x sem reseed
pnpm test:api:cov                      # cobertura services/api
pnpm test:ops:unit                     # 1242/1242
pnpm test:ops:unit:cov

# Maestro (aparelho/emulador API <= 34):
pnpm --filter ops.fonte build:e2e:android -- --device emulator-5556
adb -s emulator-5556 install -r <apk impresso pelo script>
pnpm test:setup
pnpm test:ops                          # 13/13
```

### Nada de PENDENTE-MANUAL — mas três achados que viram story

1. **`GET /residents/:id/receivables` é `@Roles(ADMIN, COORDINATOR)`.** A declaração de contribuição
   em produtos é, hoje, **impossível para SERVANT** — devolve 403 e a tela mostra "Erro ao carregar o
   carnê do filho." Por isso o `product-contributions.yaml` passou a logar como coordenador (mesmo
   precedente de `census.yaml`). A restrição é deliberada e espelhada no pacote offline
   (`offline-sync.service.ts:99-102`), então **não** foi tocada. Liberar o fluxo ao servo é decisão de
   backend → story própria.
2. **Bug de hidratação offline no `ops.fonte` (contornado com um `swipe` no spec, documentado no
   yaml).** `GET /houses/:id/residents` devolve linha enxuta **sem `houseId`**;
   `hydrateResidentQueries` (`lib/offline/store/hydrate.ts:72-74`) semeia essa linha na chave de
   **detalhe** como dado **fresco** — sem o `needsServerConfirmation` que a própria função aplica a
   `residents.byHouse`. Com `staleTime: 30_000`, a ficha aberta logo após o login não rebusca:
   `resident.houseId` fica `undefined` → `useInventoryCatalog('')` desabilitado → "Nenhum produto
   encontrado.". **Mesmo bug esconde o `ChangeMinistryModal`** (`ResidentDetailPage.tsx:138`). Fora do
   escopo da 183 (`lib/offline/` é intocável nela) → story própria; ao corrigir, remover o `swipe`.
3. **A suíte Maestro não é 100% estável em execução seguida.** Numa primeira batelada `census` e
   `dashboard` falharam em ~7s cada (11/13) e passaram isolados e na batelada seguinte **sem
   edição** — hiccup de launch do driver, não asserção.

### Branches (nenhuma deletada, nenhum push)

- `test/story-182-e2e-fixtures-idempotentes` → merge `a8e9812`
- `chore/story-184-ops-e2e-build-reproduzivel` → merge `9335606`
- `fix/story-183-ops-e2e-storeroom-contribuicao` → merge `a9bf7a1`

Serviços deixados de pé: postgres/redis, API de teste (3001), adm dev:test (5174).
