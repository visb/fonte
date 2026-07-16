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
| 1 | 125 — sugeridos: selecionar todos + abrir filho em nova aba | [ ] | | | |
| 2 | 126 — adotar toast (sonner) no adm.fonte | [ ] | | | |
| 3 | 127 — marcar "já fez" o curso bíblico fora do sistema | [ ] | | | |
| 4 | 128 — assinatura do usuário logado nos documentos | [ ] | | | |
| 5 | 129 — ordenação na listagem de filhos | [ ] | | | |
| 6 | 130 — preferências do usuário + filtros persistidos | [ ] | | | |

## Log

Entrada curta — máx. ~3 linhas. Detalhe rico vai no corpo do commit ou no `.md` arquivado.

## Resumo final

<pendente — rodada em andamento>
