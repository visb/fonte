# PROGRESS — rodada de autorun 175–181 (encerrada)

Aberta em 2026-08-14, estendida com a 181 em 2026-08-16, encerrada em 2026-08-16.

## Config da rodada

- **Tema:** offline-first do `ops.fonte` (snapshot da casa + store SQLite + navegação) e melhorias de
  identificação visual do filho (contagem no ops, matriculados no adm, abas do detalhe da casa), mais
  a estrutura genérica de templates de recibo.
- **Ordem:** 177 → 175 → 176 → 179 → 178 → 180 → 181.
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:**
  - **177 → 175** (declarada na 175): sem `GET /houses/:id/offline-snapshot` o aquecimento da 175
    nasce com `1 + N×4` requests e teria de ser reescrito. Se a 177 bloquear, a 175 bloqueia junto.
  - **175 → 179** (ordem, não conteúdo): as duas tocam a área de filhos do `ops.fonte`; a 179 abre o
    modal em cima do dado que a 175 passa a servir do store local.
- **Escopo técnico por story:**
  - **177** — backend + contratos: migration nova (índices `updated_at`/FKs), `packages/types`
    (`HouseOfflineSnapshot`, `OfflineSnapshotDeleted`), `api-client`
    (`offlineSync.houseSnapshot`), Postman (endpoint novo, 2 variantes).
  - **175** — frontend-only (`ops.fonte`): `expo-sqlite` + driver web (AsyncStorage), `user_version`
    para migração do store. Sem backend/contrato/Postman.
  - **176** — frontend-only (`ops.fonte`), tab "Menu" no lugar de "Perfil". Sem backend/Postman.
  - **179** — frontend-only (`ops.fonte`), modal do filho na contagem + foto em tela cheia.
  - **178** — backend + adm: migration nova (templates genéricos/kind), `packages/types` (enums),
    `api-client` (`documentTemplates.list({ kind })`), Postman (rota nova + query param + campos).
  - **180** — adm + response body de `GET /bible-courses/classes/:id` (sem migration);
    `build:api-client` + Postman (campo novo no exemplo).
  - **181** — adm (`PersonAvatar` compartilhado + migração de 6 call sites + abas Filhos/Servos do
    detalhe da casa) + `HouseService.findStaffForHouse` ganha `photo_url` (sem migration);
    `api-client` (`HouseStaffSummary` no lugar de `Staff[]`) + Postman.
- **Cuidados da rodada:**
  - **Contratos:** 177, 178, 180 e 181 mudam `packages/types`/`api-client` → `pnpm build:types &&
    pnpm build:api-client` antes de subir API/adm e antes dos gates.
  - **Migrations:** 177 e 178 criaram migration nova — `pnpm migration:run:test` após cada uma.
  - **Postman:** 177, 178, 180 e 181 atualizaram `fonte-api.postman_collection.json`.
  - **Offline-first é invariante do `ops.fonte`** (175/176/179).
  - **Maestro** (`test:ops`/`test:app`) sem emulador nesta máquina → PENDENTE-MANUAL, não bloqueio.
  - Gate de cobertura ≥ 90 no escopo tocado; merge só com suíte da área verde.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 177 — backend: snapshot offline da casa (agregado + delta) | [OK] | api 1516 · e2e 541 · api-client 290 | ff28960 | 6dad0c0 |
| 2 | 175 — ops: ficha dos filhos persistente em SQLite | [OK] | ops unit 1093 · e2e-web 17 | 61e3422 | 14cb6ec |
| 3 | 176 — ops: tab "Menu" no lugar de "Perfil" | [OK] | ops unit 1146 · e2e-web 19 | ec5f8b7 d72f9f3 | e10a321 |
| 4 | 179 — ops: modal de detalhes do filho na contagem + foto em tela cheia | [OK] | ops unit 1186 · e2e-web 20 | 4c0770b | 1080774 |
| 5 | 178 — templates de recibo: estrutura genérica + contribuição mensal | [OK] | api 1592 · e2e 561 · adm unit 1641 · adm e2e 38 · api-client 292 | d1eed32 | 8ad0314 |
| 6 | 180 — adm: foto e acesso ao perfil na listagem de matriculados | [OK] | api 1594 · e2e 562 · adm unit 1646 · adm e2e 181 | 75fd042 | 2352c34 |
| 7 | 181 — adm: avatar nas abas Filhos e Servos do detalhe da casa | [OK] | api 1597 · e2e 564 · adm unit 1661 · adm e2e 184 | 1bd0725 | a2237e8 |

## Log

```
[OK] 177 — testes: api 1516/1516 · e2e 541/541 (offline-snapshot 19/19) · api-client 290/290;
     cobertura offline-sync 100%, global api 92.3% — commit: ff28960 — merge: 6dad0c0 — 2026-08-14
     Nota: delta comparava timestamp em hora local (driver pg vs. coluna sem timezone) — corrigido
     com `common/lib/db-timestamp.ts`; carnê (`receivables`) não desce para SERVANT.

[OK] 175 — testes: ops unit 1093/1093 · e2e-web 17/17; cobertura store/sync 100%, all files 94.3%
     — commit: 61e3422 — merge: 14cb6ec — 2026-08-14
     PENDENTE-MANUAL: Maestro e roteiro manual (modo avião + restart) sem emulador nesta máquina.
     Nota: `driver.web.ts` colidia com extensão de plataforma do Metro (quebrava só no bundle web);
     hidratação de `residents.byHouse` marca lista/contagem como pendentes para não furar o censo.

[OK] 176 — testes: ops unit 1146/1146 · e2e-web 19/19; cobertura features/menu 100%, global 94.4%
     — commit: ec5f8b7 + d72f9f3 — merge: e10a321 — 2026-08-14
     PENDENTE-MANUAL: Maestro (`e2e/auth.spec.yaml` já ajustado, falta rodar em aparelho).
     Nota: `canAccessMenuItem` virou fonte única (tabs + menu + atalhos); paridade com as regras
     antigas travada por teste-oráculo — diff de acesso revisado pelo orquestrador antes do merge.

[OK] 179 — testes: ops unit 1186/1186 · e2e-web 20/20 (inclui modal sem sinal); cobertura global 94.5%
     — commit: 4c0770b — merge: 1080774 — 2026-08-14
     PENDENTE-MANUAL: Maestro — falta `e2e/helpers/login-coordinator.yaml` + `census.yaml` (não há
     fluxo de contagem em `e2e/` e a tela é COORDINATOR-only); sem emulador nesta rodada.
     Nota: `lib/offline/` intocado — o modal lê `['resident', id]` do store da 175 e não escreve.

[OK] 178 — testes: api 1592/1592 · e2e 561/561 (receipts 20/20) · adm unit 1641/1641 · adm e2e 38/38 ·
     api-client 292/292; cobertura receipt 99.3%, document-template 97.0%, api global 92.5%, adm 93.4%
     — commit: d1eed32 — merge: 8ad0314 — 2026-08-15
     Nota: `AttachmentsTab` ganhou filtro defensivo de 1 linha (`kind !== RECEIPT`) — o plano dizia
     "sem mudança", mas o teste exigido pela Validação era impossível sem ele; `payerCpf` sai como
     "não informado" (Associate ainda não tem CPF no schema).

[OK] 180 — testes: api 1594/1594 · e2e 562/562 · adm unit 1646/1646 · adm e2e 181/181; cobertura
     EnrollmentRow 100%, api global 92.5%, adm 93.4% — commit: 75fd042 — merge: 2352c34 — 2026-08-16
     Nota (ambiente, pré-existente): suítes e2e só são idempotentes com `pnpm test:setup` antes —
     `residents.spec.ts` deixa as 6 parcelas PAID e `test:adm` antes do `test:api:e2e` derruba o
     `afterAll` de `storerooms.e2e-spec.ts` (FK `receivable_product_contributions` → CHK xor).

[OK] 181 — testes: api 1597/1597 · e2e 564/564 · adm unit 1661/1661 · adm e2e 184/184; cobertura
     components/shared 100%, features/houses 99.6%, modules/house 92.5%, adm global 93.4%
     — commit: 1bd0725 — merge: a2237e8 — 2026-08-16
     Nota: `tsc` do adm provou a decisão 6 (estreitar `Staff[]` → `HouseStaffSummary[]`): nenhum
     consumidor lia campo fora do resumo, nem em `ops.fonte`. As 6 suítes migradas passaram intocadas.
```

## Resumo final

**7/7 stories concluídas [OK]. Nenhuma BLOQUEADA.**

### O que entrou

- **Offline-first do `ops.fonte`** (177 + 175 + 179): endpoint agregado
  `GET /houses/:id/offline-snapshot` (com delta por `updated_at`), store SQLite (`expo-sqlite` +
  driver web sobre AsyncStorage, versionado por `user_version`) e o modal de detalhes do filho na
  contagem lendo do store local.
- **Navegação do `ops.fonte`** (176): tab "Menu" no lugar de "Perfil", com `canAccessMenuItem` como
  fonte única de permissão para tabs, menu e atalhos.
- **Templates de recibo** (178): estrutura genérica por `kind` + template de contribuição mensal.
- **Identificação visual do filho no `adm.fonte`** (180 + 181): foto e link para o perfil na listagem
  de matriculados do curso bíblico; `PersonAvatar` compartilhado extraído e adotado nos 8 call sites
  (6 migrados + 2 novos), avatar nas abas Filhos e Servos do detalhe da casa, e
  `GET /houses/:id/staff` passando a devolver `photoUrl` sob um `HouseStaffSummary` honesto.

### PENDENTE-MANUAL (nada bloqueia código; tudo é ambiente)

1. ~~**Maestro (`test:ops`) nas stories 175, 176 e 179**~~ — **RESOLVIDO em 2026-08-16**, em
   emulador. `census.yaml` + `helpers/login-coordinator.yaml` criados (179), `auth.spec.yaml`
   corrigido (176) e `residents-offline.yaml` criado (175) — este último automatiza o roteiro que
   era manual, com `setAirplaneMode` + `stopApp`/`launchApp` sem `clearState`. Os três passam.
   Suíte `test:ops` inteira: **11/13**. Ver o bloco "Maestro em aparelho" abaixo.
2. **Suítes e2e não são idempotentes entre si** (achado pré-existente, confirmado nas 180 e 181):
   - `residents.spec.ts` (Playwright) deixa as 6 parcelas do "João Testador" como PAID → num segundo
     run sem reseed, 2 testes falham por não haver parcela pendente.
   - `storerooms.e2e-spec.ts` (backend) consome o estoque de "Arroz (kg)" → `residents.spec.ts:518`
     ("aba Contribuição: declara produtos") fica sem opção no `<select>` do catálogo.
   - Rodar `test:adm` **antes** de `test:api:e2e` deixa um `receivable_product_contributions`
     apontando para o item STOREROOM; o `afterAll` de `storerooms.e2e-spec.ts`
     (`DELETE FROM inventory_items WHERE kind='STOREROOM'` → `ON DELETE SET NULL`) então viola
     `CHK_rpc_item_xor_description` e derruba a suíte.

   **Vale uma story própria**: desacoplar as duas suítes com fixture de storeroom dedicada no seed.
   Até lá, a ordem que fecha verde é: `pnpm test:setup` → `pnpm test:api:e2e` → `pnpm test:setup` →
   `pnpm test:adm`.

### Maestro em aparelho (2026-08-16)

Primeira execução real da suíte `test:ops` — os specs existiam mas nunca tinham rodado. Pré-requisitos
descobertos, todos não óbvios:

- **Maestro 2.6.0 não funciona em Android 16/17 (SDK 36/37).** Em SDK 37 o driver morre
  (`Not able to reach the gRPC server` → `StatusRuntimeException: UNAVAILABLE`); em SDK 36 nem inicia
  o fluxo (loop de `Failed to record heartbeat`). Usar **API 34**
  (`system-images;android-34;google_apis;x86_64`, AVD `Maestro_API34`).
- **APK release bloqueia HTTP puro.** `usesCleartextTraffic="true"` só existe no manifest de *debug*,
  então o app não alcança `http://10.0.2.2:3001` e a tela de login mostra a mensagem genérica de
  credenciais. Build de e2e precisa do atributo no manifest de `main`. **Não commitado** — `android/`
  é gerado por CNG; ver "a fazer" abaixo.
- **ABI**: o emulador é x86_64 → `-PreactNativeArchitectures=x86_64` (a receita da memória usava
  arm64-v8a, de aparelho físico).
- **Maestro não digita fora do ASCII** (mobile-dev-inc/maestro#146): `inputText` com acento aborta o
  fluxo. Quatro specs tinham isso. Asserção de texto acentuado funciona normalmente.
- **Match de texto é regex de match COMPLETO**: `"Aprovados"` não casa com `"Aprovados (1)"`.

Correções aplicadas nos specs pré-existentes: scroll até "Sair" (o item é o último do menu e nasce
abaixo da dobra), fechar a folha de notificações pelo botão `Fechar` (tocar no título não fecha),
`.*` nas abas com contador, e texto digitado em ASCII.

**Restam 2 de 13 vermelhos, ambos pré-existentes e fora do escopo desta rodada** — merecem story
própria, na mesma família da 182 (determinismo de e2e):
- `storeroom.yaml`: `tapOn: "Arroz"` casa com o texto digitado no próprio campo em vez da sugestão do
  dropdown, e o item nunca é selecionado ("Selecione um item"); o dropdown só oferece
  `+ Cadastrar "Arroz"`, sugerindo que o catálogo pesquisado no formulário de movimentação não é o
  que o seed popula.
- `product-contributions.yaml`: falha logo ao abrir a declaração (`"Parcela"` não visível) — provável
  dependência de carnê que o seed não garante para o filho usado.

### Reproduzir os gates

```bash
pnpm docker:up
pnpm test:setup
pnpm build:types
pnpm build:api-client
pnpm dev:api:test                    # terminal próprio, porta 3001
pnpm --filter adm.fonte dev:test     # terminal próprio, porta 5174

pnpm test:api                        # 1597
pnpm test:api:e2e                    # 564 (reseed antes)
pnpm test:adm:unit                   # 1661
pnpm test:adm                        # 184 (reseed antes)
pnpm --filter ops.fonte test         # ops unit 1186
pnpm --filter ops.fonte test:e2e-web # e2e-web 20
```

### Branches (sem push, sem PR)

`feat/story-177-*` · `feat/story-175-*` · `feat/story-176-*` · `feat/story-179-*` ·
`feat/story-178-*` · `feat/story-180-matriculados-foto-e-perfil` ·
`feat/story-181-avatar-abas-da-casa` — todas preservadas, todas mergeadas na `main` local com
`--no-ff`. **A `main` local está 33 commits à frente da `origin/main`.**
