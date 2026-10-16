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
| 2 | 201 — `DateInput` próprio no adm | [ ] | | | |
| 3 | 202 — Nascimento só de maiores de 18 | [ ] | | | |
| 4 | 203 — Coerência das datas de entrada e saída | [ ] | | | |
| 5 | 206 — Card de filho responsivo (adm) | [ ] | | | |
| 6 | 204 — Listagem de servos no ops | [ ] | | | |
| 7 | 205 — Restaurar vínculo filho↔ministério | [ ] | | | |
| 8 | 207 — Nível do servo no ops | [ ] | | | |
| 9 | 208 — Atividades em colunas no ops | [ ] | | | |
| 10 | 209 — Campos de data digitáveis no ops | [ ] | | | |
| 11 | 210 — Estado civil: união estável e viúvo(a) | [ ] | | | |
| 12 | 211 — Rascunho automático do acolhimento | [ ] | | | |
| 13 | 212 — Tipo do template de recibo + nome do arquivo | [ ] | | | |
| 14 | 199 — Auditoria de ações dos usuários | [ ] | | | |

## Log

- [OK] 200 — testes: adm unit 1778/1778 (93.7%), adm e2e residents 33/33, ops unit 1384/1384 (96.0%), ops e2e-web 26 (2 de contribuições flakam sob carga, 4/4 isoladas) — commit: f2d2548 — merge: a9fba41 — 2026-10-16 — Maestro PENDENTE-MANUAL.
  Nota de ambiente: `.env.test` liberou CORS p/ 5176/8083 (d7226d8); reiniciar `dev:api:test` a partir da `main` (env só é lido no boot). `build:web:test` usa sintaxe POSIX — no Windows exportar `EXPO_PUBLIC_API_URL` antes.

## Resumo final

<vazio até o fim da rodada>
