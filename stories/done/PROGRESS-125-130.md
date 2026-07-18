# PROGRESS — stories 125–130 (sugeridos do curso + toast + assinatura + ordenação/preferências)

Ordem: 125 → 126 → 127 → 128 → 129 → 130. Fonte de verdade: esta seção + git log.

**Config da rodada**

- **Branch base:** `main` (cada branch parte da main ATUAL, já com o merge da anterior).
- **Prefixo de branch:** `feat/story-NN-<slug>`.
- **Deps rígidas** (se a de cima bloquear, a de baixo bloqueia junto — não pular):
  - **127 → 126** (usa `toastAction` "Desfazer"; sem o toast a story não fecha) **e 127 → 125**
    (ambas editam `EligibleResidentRow.tsx`; 125 remove o `<label>` que a 127 depende de não existir).
  - **130 → 129** (`sort` só existe na URL depois da 129; a chave `residents.filters` guarda `sort`).
  - 128 é independente das demais.
- **Cuidados da rodada:**
  - **Migrations novas em 3 stories** (127 `bible_course_external_completions`, 128
    `staff.signature_url`, 130 `user_preferences`). Última aplicada: `1783036900000-AllowNullResidentHouse`.
    Timestamps **crescentes e únicos** entre elas; nunca editar migration já aplicada; rodar
    `pnpm --filter api migration:run:test` após criar.
  - **Contratos** (`packages/types` + `api-client`) mudam em 127, 128, 129 e 130 → `pnpm build:types
    && pnpm build:api-client` antes de rodar suíte do adm (sem o `dist/` a suíte adm inteira quebra).
  - **Postman obrigatório** (`fonte-api.postman_collection.json`): 127 (3 endpoints), 128
    (`POST /staff/me/signature` + `signatureUrl` no `GET /staff/me`), 129 (`sort`/`order` em
    `GET /residents`), 130 (3 endpoints).
  - **Dependências novas** (rodar `pnpm install` no app): 126 `sonner`, 128 `react-signature-canvas`.
  - **Bucket/storage** (128, assinatura): usar o `StorageService` existente atrás da interface, com
    mock nos testes. Não chamar bucket real; se o ambiente de teste não tiver storage, marcar
    PENDENTE-MANUAL só a parte de upload real — a lógica e os testes vão mockados.
  - **Gate de cobertura ≥ 90** no pacote tocado, sem `skip`/`only`/`xfail` injustificado.
  - **Armadilhas já mapeadas nos planos** (estão nos `.md`, repetidas aqui por serem silenciosas):
    128 → `ALWAYS_AVAILABLE` em `AttachmentsTab.tsx` precisa incluir `signature`; 129 → desempate por
    `id ASC` senão a paginação repete/pula; 130 → preservar a distinção `status` ausente vs
    presente-e-vazio.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 125 — sugeridos: selecionar todos + abrir filho em nova aba | [OK] | unit 1214/1214 · cov adm 92% | e73cf01 | 81c45e8 |
| 2 | 126 — adotar toast (sonner) no adm.fonte | [OK] | unit 1230/1230 · cov 92.03% | 4b34010 | 824e972 |
| 3 | 127 — marcar "já fez" o curso bíblico fora do sistema | [OK] | api 1206/1206 · e2e 468/468 · adm unit 1248/1248 · cov escopo ≥90 | aa1a6c7 | ea544cd |
| 4 | 128 — assinatura do usuário logado nos documentos | [OK] | api 1220/1220 · e2e 473/473 · adm unit 1259/1259 · cov escopo ≥90 | 63eab0e | c827276 |
| 5 | 129 — ordenação na listagem de filhos | [OK] | api 1227/1227 · e2e 478/478 · adm unit 1267/1267 · cov escopo ≥90 | e549404 | 4fa0ab5 |
| 6 | 130 — preferências do usuário + filtros persistidos | [OK] | api 1254/1254 · e2e 485/485 · adm unit 1291/1291 · cov escopo 100% | 0d5d441 | b9ea856 |

## Log

Entrada curta — máx. ~3 linhas. Detalhe rico vai no corpo do commit ou no `.md` arquivado.

[OK] 125 — testes: adm unit 1214/1214 · bible-courses e2e 11 passed/2 skipped · cov adm 92% st
(gate exit 0), bible-courses 91.71% — commit: e73cf01 — merge: 81c45e8 — 2026-07-16 — 1º spawn
cortado por limite de sessão; agent retomado do transcript. Plano tinha Decisão 1 contradizendo o
próprio Desenho/Validação (tri-state parcial) — corrigida ao arquivar.

**ACHADO QUE AFETA A RODADA (129 e 130):** `features/residents` está quebrada na `main`, não pelo
nosso diff. 4 erros de `tsc` (`ContributionsTab.tsx`, `useBulkImport.ts` "Expected 2 arguments, but
got 3", `residentSchema.ts`) e 7 e2e falhando (`residents`/`payables`/`activities`), confirmados
idênticos com `git stash` (pré-existentes). **129 e 130 tocam `features/residents`** — o implementer
dessas stories não vai conseguir suíte limpa nessa área e deve distinguir regressão nova de falha
pré-existente (comparar com a main via stash antes de reportar).

[OK] 126 — testes: adm unit 1230/1230 (+16 vs baseline main, zero regressão) · e2e bible-courses 13
passed/2 skipped · cov `features/bible-courses` 91.71%→92.02%, `src/lib` 75.19%→76.33% — commit:
4b34010 — merge: 824e972 — 2026-07-16. `toastAction(msg, {label,onClick})` pronto para a 127.

**Nota 126:** contagem de falhas pré-existentes corrigida — são **8** (7 `residents` + 1 `payables`;
`activities` está verde), confirmadas byte-idênticas na main via stash. Agent também precisou
reinstalar o `sonner` e reiniciar o dev server 5174: quem rodar e2e após um `pnpm install` pode
precisar do restart (o Vite quebra com `Failed to resolve import "sonner"` e derruba todo o e2e no
login). Dois desvios conscientes do plano, ambos coerentes com a decisão 4: `EnrollResidentDialog`
perdeu o erro inline (o hook dele está na tabela — inline + toast ficaria duplicado) e
`BibleModuleDialog` ficou intacto (hooks fora da tabela; sem toast, remover o inline deixaria falha
sem feedback).

**Ressalva 125:** os 2 skips do e2e são do seed, não do código — o seed tem filho com `entry_date` =
hoje e a regra exige 3+ meses, então `eligible-residents` volta `[]` e o painel não renderiza (atinge
também o e2e da story 99). O agent retrodatou o seed temporariamente, viu os 2 passarem de verdade e
restaurou o banco. Fluxo validado, mas a suíte versionada segue pulando: corrigir exige mexer no seed
(fora do escopo). Candidato a story própria, junto do conserto da `residents`.

[OK] 127 — testes: api unit 1206/1206 · e2e 468/468 (bible-courses +13 casos; storerooms era
poluição de dados no DB de teste, 65/65 após reseed — não regressão) · adm unit 1248/1248 · adm
Playwright bible-courses story-127 PASS · cov escopo ≥90 — commit: aa1a6c7 — merge: ea544cd —
2026-07-17. 1º spawn cortado 2× por limite de sessão (deixou markup corrompido na entity/migration +
forFeature faltando, corrigido pelo orquestrador); retomado via SendMessage do transcript. As 8
falhas de `test:adm` (Playwright) em features/residents seguem pré-existentes (confirmado por stash;
superconjunto na main).

[OK] 128 — testes: api unit 1220/1220 · e2e 473/473 · adm unit 1259/1259 · api-client 260/260 · cov
`document-template` 95.03% / `staff` 93.2% (API escopo) · adm global 92.02% st (catraca exit 0) —
commit: 63eab0e — merge: c827276 — 2026-07-17. 1º spawn deixou a story quase completa; retomada
partiu do diff não commitado na branch (não recomeçou do zero). Correção: 3 asserts em
`document-template.service.spec.ts` checavam substring `doc-signature`/`doc-signature-img` que também
aparece no CSS de `wrapPage` → apertados p/ markup real do corpo. Playwright `document-templates` 12/12;
`residents.spec.ts` 6 failed/22 passed **idêntico na main via stash** (pré-existente, zero regressão).
PENDENTE-MANUAL: upload de bucket mockado (sem S3 no teste, mesmo padrão da foto); sem spec Playwright
dedicado ao desenho no canvas (frágil; coberto por unit — `SignatureDialog`/`AttachmentsTab`).

[OK] 129 — testes: api unit 1227/1227 · e2e 478/478 (inclui 400 p/ `sort=name;DROP` + paginação
estável com datas repetidas) · adm unit 1267/1267 · cov escopo `features/residents`+`lib/queryKeys`
98.74% st / 93.91% br — commit: e549404 — merge: 4fa0ab5 — 2026-07-18. 1º spawn cortado por limite;
retomada partiu do diff não commitado (completo, sem lacuna). Armadilha do desempate `id ASC` já
estava correta (`.addOrderBy('resident.id','ASC')` após `NULLS LAST`). Playwright `residents.spec.ts`
23 passed/6 failed — as 6 são as pré-existentes da rodada, **idênticas na main via stash** (zero
regressão). Sem PENDENTE-MANUAL.

[OK] 130 — testes: api unit 1254/1254 · e2e 485/485 (+7 preferences.e2e) · adm unit 1291/1291 ·
api-client 264/264 · cov escopo backend `preference` 100% e adm tocado 100% — commit: 0d5d441 —
merge: b9ea856 — 2026-07-18. Migration `1783037200000-UserPreferences` aplicou limpa. Armadilha
`status` ausente-vs-vazio preservada. Descoberta técnica: efeito que sincroniza `q` na URL rodava no
mount e sobrescrevia a hidratação dos filtros (ambos `setSearchParams` leem a URL original no mesmo
commit, último vence) → guard `didSyncSearch` ref pula a 1ª sincronização (no-op semântico). Os 4
erros TS pré-existentes (`ContributionsTab`, `useBulkImport`, `residentSchema`) confirmados idênticos
na main via stash — nenhum arquivo tocado pela 130. PENDENTE-MANUAL: Playwright pulado por decisão
consciente (persistir filtro do `admin@fonte.com` no DB de teste compartilhado vazaria entre specs da
`residents.spec.ts`); 3 cenários do plano cobertos deterministicamente em vitest de
`ResidentsPage`/`AuthContext` com 100% cov. Recomendação p/ quem for adicionar specs Playwright:
`afterEach` com `DELETE /preferences/residents.filters` antes de trocar de sessão.

## Resumo final

Rodada 125–130 **concluída** — 6/6 stories `[OK]`, zero bloqueadas, tudo mergeado na `main` via
`--no-ff` e planos arquivados em `stories/done/`.

| Story | Commit | Merge |
| --- | --- | --- |
| 125 — sugeridos: selecionar todos + nova aba | e73cf01 | 81c45e8 |
| 126 — adotar toast (sonner) no adm | 4b34010 | 824e972 |
| 127 — marcar "já fez" curso bíblico fora do sistema | aa1a6c7 | ea544cd |
| 128 — assinatura do usuário logado nos documentos | 63eab0e | c827276 |
| 129 — ordenação na listagem de filhos | e549404 | 4fa0ab5 |
| 130 — preferências do usuário + filtros persistidos | 0d5d441 | b9ea856 |

**Migrations aplicadas na rodada:** `bible_course_external_completions` (127), `staff.signature_url`
(128, `1783037100000`), `user_preferences` (130, `1783037200000`).

**Dívidas / follow-ups deixados pela rodada (candidatos a story própria):**
- **`features/residents` quebrada na `main` por falhas PRÉ-EXISTENTES** (não desta rodada): 4 erros
  `tsc` (`ContributionsTab.tsx`, `useBulkImport.ts`, `residentSchema.ts`) + 6 e2e Playwright
  (cria/edita residente, wizard Histórico, DISCHARGED Reintroduzir, gateway reintrodução,
  Contribuição sem dinheiro). Confirmadas idênticas na main via stash em 128/129/130. Precisam de
  conserto dedicado.
- **Seed do e2e** (ressalva 125): filho com `entry_date` = hoje faz `eligible-residents` voltar `[]`
  → 2 skips permanentes em bible-courses/story-99. Corrigir exige mexer no seed.
- **Playwright da 130**: adicionar specs do fluxo de preferências com limpeza `afterEach` (ver nota
  da 130 acima).
- **LGPD** (fora de escopo 128): conferir se o inventário `docs/lgpd/` precisa registrar o dado novo
  `staff.signature_url` (imagem de assinatura).
