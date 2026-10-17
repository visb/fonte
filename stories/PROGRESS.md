# PROGRESS — ledger ativo

Rodada de autorun **199–212** — aberta em 2026-10-15.

## Config da rodada

- **Tema:** datas e validações de cadastro (seletor/digitação de data, maioridade, coerência
  entrada/saída, estado civil), ações na lista de filhos, servos e ministérios no `ops`, atividades
  em colunas, rascunho do acolhimento, templates/nome de recibo, e auditoria de ações (fecha a
  rodada).
- **Ordem:** 200 → 201 → 202 → 203 → 206 → 204 → 205 → 207 → 208 → 209 → 210 → 211 → 212 → 199
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior). Prefixo
  `feat/story-NN-<slug>`.
- **Deps rígidas** (se a primeira bloquear, a segunda bloqueia junto):
  - **204 → 207**: a 207 põe o badge de nível no `StaffListItem` e no `findStaffForHouse`
    estendido, que a 204 cria.
  - **202 + 203 → 209**: a 209 **reusa** `todayInSaoPaulo`, `isAdultBirthDate` (202) e
    `isFutureDate` (203) de `@fonte/types`, e assume os limites de `RemoveResidentModal` (203) e a
    validação de nascimento do `AddResidentModal` (202). Feita antes, a 209 duplicaria helper e
    conflitaria nos mesmos arquivos.
- **Deps de ordem (não bloqueiam, evitam rebase):**
  - 200 → 203: os dois tocam `RemoveResidentDialog`/`RemoveResidentModal`.
  - 201 → 202 → 203: `DateInput` do `adm` com `min`/`max`; `todayInSaoPaulo` nasce na 202.
  - 204 → 205: mesmo hook/query key de servos da casa no `ops` (`queryKeys.staff.byHouse`).
  - 205 → 207: a 205 devolve líder `RESIDENT`; o `leaderRank` da 207 é `null` nesse caso.
  - 201/202/203 → 211: tocam `ResidentFormSections`/`ReadmissionForm`, que a 211 envolve com o
    rascunho.
  - **199 por último**: instrumenta os caminhos de escrita de resident/staff/house/ministry/contagem/
    produtos. Feita no fim, cobre as rotas que 202/203/205/210/212 mexeram ou restauraram.
- **Escopo técnico por story:**
  - **200**: sem migration, sem rota; `packages/types` (rótulos); `adm` + `ops`.
  - **201**: só `adm` (`DateInput` próprio). Sem backend, sem Postman.
  - **202**: sem migration; `packages/types` (`MIN_PERSON_AGE`, `todayInSaoPaulo`,
    `isAdultBirthDate`...); resident/staff/import services; Postman (400); `adm` + `ops`.
  - **203**: sem migration; `packages/types` (`isFutureDate`, mensagens); resident/import;
    Postman (400); `adm` + `ops`.
  - **206**: só `adm` (card responsivo). Sem backend.
  - **204**: sem migration; `findStaffForHouse` estendido; `api-client`; Postman; `ops` (feature
    `staff`, allowlist offline + prefetch, troca da query key).
  - **205**: **migration** `RestoreResidentMinistryLink` (não usar `git revert 1884270`);
    `packages/types` + `api-client`; rotas de volta; Postman; `adm` + `ops` (offline store).
  - **207**: sem migration; `rank` em `findStaffForHouse` + `leaderRank` em ministérios;
    `api-client`; Postman; `ops`.
  - **208**: só `ops` (atividades em abas). Sem backend.
  - **209**: só `ops` (`DateInput` + migração de todos os campos de data). Sem backend.
  - **210**: **migration** `ALTER TYPE ... ADD VALUE` (2 enums); `packages/types`; resolver de
    documentos + parser docx; Postman; `adm`.
  - **211**: só `adm` (rascunho em `localStorage`) + nota em `docs/lgpd/DIAGNOSTICO_LGPD.md`.
  - **212**: sem migration; 404 com `code`; `packages/types` (`residentReceiptFilename`);
    Postman; `adm` + **`app.fonte`**.
  - **199**: **migration** (campos novos em `audit_logs`); módulo `audit`; `api-client`; Postman;
    `adm` (tela ADMIN). Grande: se estourar orçamento, PARCIAL com o que ficou verde.
- **Cuidados da rodada:**
  - **`migration:run:test`, NUNCA `migration:run`.** Sem `NODE_ENV=test`, o `data-source.ts` lê
    `services/api/.env`, que aponta para **produção**. Vale para 205, 210 e 199.
  - **Nunca `pnpm dev:api`** durante o run; só `pnpm dev:api:test` (porta 3001).
  - **210: `ALTER TYPE ... ADD VALUE`** não pode ser usado na mesma transação em que é criado; o
    `down` recria o tipo e zera os valores novos (documentar no arquivo).
  - `pnpm build:types && pnpm build:api-client` depois de **200, 202, 203, 204, 205, 207, 210, 212,
    199**. Sem o `dist/` atualizado, a suíte do `adm` quebra inteira.
  - **`ops` offline-first** (CLAUDE.md): 204 (allowlist + prefetch), 205 (store de filhos), 207
    (placeholders com `rank`/`leaderRank: null`) e 209 (payloads **inalterados**) não podem quebrar
    fila/replay. Rodar `test:ops:unit` + Playwright `e2e-web/` offline nas que tocam `lib/offline/`.
  - **209 × 202 (maioridade)**: na contagem, a 209 exige 18+ **na data de acolhimento** (decisão
    do usuário). Isso implica o 18+ "hoje" da 202, então não há contradição. Usar
    `isAdultBirthDate(birth, entryDate)` da 202, sem `ageAt` próprio. Nas demais telas vale a 202.
    O "hoje" da 209 é `todayInSaoPaulo()`, não um `todayLocalIso` novo.
  - **209 substitui o picker do `RemoveResidentModal`** que a 203 limitou: preservar
    `min = entryDate`/`max = hoje` no `DateInput`.
  - **Maestro** (`test:ops`/`test:app`) exige emulador API ≤34 + Metro. Sem ambiente, registrar
    **PENDENTE-MANUAL** e não bloquear a story se unit + Playwright estiverem verdes.
  - **e2e idempotente (story 182):** fixture própria, limpeza por id, seed só leitura.
  - Cobertura ≥90 no escopo tocado, em toda story.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 200 — Declarar saída da comunidade / Transferir de casa | [OK] | adm unit 1778 + e2e 33; ops unit 1384 + e2e-web 26 | f2d2548 | a9fba41 |
| 2 | 201 — `DateInput` próprio no adm | [OK] | adm unit 1820 + e2e 80 | b1f533b | eaa86dc |
| 3 | 202 — Nascimento só de maiores de 18 | [OK] | api 1904 + e2e 655; adm 1836 + e2e 51; ops 1393 | 06dd07f | e60546f |
| 4 | 203 — Coerência das datas de entrada e saída | [OK] | api 1948 + e2e 662; adm 1862; ops 1405 + e2e-web 7 | 922adb5 | d393515 |
| 5 | 206 — Card de filho responsivo (adm) | [OK] | adm unit 1883 + e2e residents 31/39 (8 pré-existentes) | e25fe8a | 1ed680e |
| 6 | 204 — Listagem de servos no ops | [OK] | api 1949 + e2e 665; ops 1433 + e2e-web 28; api-client 307 | da82541 | 0362f1c |
| 7 | 205 — Restaurar vínculo filho↔ministério | [OK] | api 2006 + e2e 670; adm 1909; ops 1459 + e2e-web 28 | 0d8f671 | d814f6c |
| 8 | 207 — Nível do servo no ops | [OK] | api 2010 + e2e 674; ops 1477 + e2e-web 28; api-client 308 | c545d17 | c035470 |
| 9 | 208 — Atividades em colunas no ops | [OK] | ops 1502 + e2e-web 29 | 63f2302 | a78aa78 |
| 10 | 209 — Campos de data digitáveis no ops | [ ] | | | |
| 11 | 210 — Estado civil: união estável e viúvo(a) | [ ] | | | |
| 12 | 211 — Rascunho automático do acolhimento | [ ] | | | |
| 13 | 212 — Tipo do template de recibo + nome do arquivo | [ ] | | | |
| 14 | 199 — Auditoria de ações dos usuários | [ ] | | | |

## Log

- [OK] 200 — testes: adm unit 1778/1778 (93.7%), adm e2e residents 33/33, ops unit 1384/1384 (96.0%), ops e2e-web 26 (2 de contribuições flakam sob carga, 4/4 isoladas) — commit: f2d2548 — merge: a9fba41 — 2026-10-16 — Maestro PENDENTE-MANUAL.
  Nota de ambiente: `.env.test` liberou CORS p/ 5176/8083 (d7226d8); reiniciar `dev:api:test` a partir da `main` (env só é lido no boot). `build:web:test` usa sintaxe POSIX — no Windows exportar `EXPO_PUBLIC_API_URL` antes.
- [OK] 201 — testes: adm unit 1820/1820 (lines 97.2%, código novo 95–100%), adm e2e 80/80, tsc limpo — commit: b1f533b — merge: eaa86dc — 2026-10-16.
  Nota: popover do calendário tem role="dialog" — spec novo usa `fillDate` (e2e/helpers/dates.ts) ou escopa `getByRole('dialog')`.
- [OK] 202 — testes: api unit 1904 (94.8%), api e2e 655/655, adm unit 1836 (97.2%), adm e2e 51/51, ops unit 1393 (96.3%) — commit: 06dd07f — merge: e60546f — 2026-10-16 — Maestro PENDENTE-MANUAL.
  Nota: `MissingFieldsDialog` (adm) sem validação de 18+ na tela (só 400 do backend); fora do plano.
- [OK] 203 — testes: api unit 1948, api e2e 662/662, adm unit 1862 (97.2%), adm e2e fluxos afetados 9/9 + bulk-import 5/5, ops unit 1405 (96.5%), ops e2e-web field-flows 7/7 — commit: 922adb5 — merge: d393515 — 2026-10-16 — Maestro PENDENTE-MANUAL.
  Nota: `residents.spec` adm completo tem 8 falhas "João Testador" fora da pág. 1 — **pré-existente na main** (banco de teste poluído por suítes que não limpam: wizard adm, bible-courses e2e, census). Bug de isolamento (story 182), fora da rodada.
- [OK] 206 — testes: adm unit 1883 (97.3%, tocados 100%), tsc limpo, e2e residents 31/39 (as 8 falhas = mesmas pré-existentes; 2 novos de viewport verdes) — commit: e25fe8a — merge: 1ed680e — 2026-10-16.
- [FIX] 203 — fixtures e2e usavam dia UTC como "hoje" → 400 entre 21h–0h BRT (~96 falhas api e2e + 3 e2e-web). Trocado por `todayInSaoPaulo()`; também readmit/alta/admission em `resident.service.ts` gravavam dia UTC — corrigido — commit: 9d1f12d — merge: 498bf9e.
  Restam dia UTC em prod (fora da rodada): resident-session (limite 25 min/dia), promotedAt, follow-up padrão, payable/associate "hoje".
- [OK] 204 — testes: api unit 1949, api e2e 665/665 e ops e2e-web 28/28 (ambos 21:31 BRT, com o fix), ops unit 1433 (95.4%), api-client 307 — commit: da82541 — merge: 0362f1c — 2026-10-16 — Maestro PENDENTE-MANUAL.
- [OK] 205 — testes: api unit 2006 (93.3%), api e2e 670/670, api-client 308, adm unit 1909, adm e2e houses 12/12 + residents 32/39 (7 = pré-existentes João Testador), ops unit 1459 (95.5%), ops e2e-web 28/28; migration up/revert/up só no test — commit: 0d8f671 — merge: d814f6c — 2026-10-17 — Maestro `ministries.yaml` PENDENTE-MANUAL.
  Nota: `PERSIST_BUSTER` → v3; BUSINESS_RULES.md (Ministérios) atualizado.
- [OK] 207 — testes: api unit 2010 (93.3%), api e2e 674/674, api-client 308, ops unit 1477 (95.5%), ops e2e-web 28/28 — commit: c545d17 — merge: c035470 — 2026-10-17 — Maestro `dashboard.yaml` PENDENTE-MANUAL (exige `pnpm test:setup`: seed-test agora dá rank CONSAGRADO ao Operador).
- [OK] 208 — testes: ops unit 1502 (código novo 100% linhas), ops e2e-web 29/29 — commit: 63f2302 — merge: a78aa78 — 2026-10-17 — Maestro `activities.yaml` PENDENTE-MANUAL (nunca executado; usa http do Maestro em 10.0.2.2:3001).

## Resumo final

<vazio até o fim da rodada>
