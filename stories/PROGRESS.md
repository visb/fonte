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
| 2 | 126 — adotar toast (sonner) no adm.fonte | [ ] | | | |
| 3 | 127 — marcar "já fez" o curso bíblico fora do sistema | [ ] | | | |
| 4 | 128 — assinatura do usuário logado nos documentos | [ ] | | | |
| 5 | 129 — ordenação na listagem de filhos | [ ] | | | |
| 6 | 130 — preferências do usuário + filtros persistidos | [ ] | | | |

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

**Ressalva 125:** os 2 skips do e2e são do seed, não do código — o seed tem filho com `entry_date` =
hoje e a regra exige 3+ meses, então `eligible-residents` volta `[]` e o painel não renderiza (atinge
também o e2e da story 99). O agent retrodatou o seed temporariamente, viu os 2 passarem de verdade e
restaurou o banco. Fluxo validado, mas a suíte versionada segue pulando: corrigir exige mexer no seed
(fora do escopo). Candidato a story própria, junto do conserto da `residents`.

## Resumo final

<pendente — rodada em andamento>
