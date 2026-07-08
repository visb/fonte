# Plan: Import de múltiplos acolhimentos (histórico na ficha)

## Context

Bloco do BACKLOG: **melhorias no import de filhos** (fichas via IA + planilha em lote).
Contexto compartilhado com as stories 119, 120, 122. **Depende da story 120** — reusa a regra de
derivação de status ALTA/EVASÃO pela permanência (`monthsBetween` + regra dos 6 meses).

**Pedido:** quando o import encontrar **várias datas de entrada** para o mesmo filho, criar
**múltiplos registros de acolhimento** (a "aba histórico" da ficha), em vez de um único.

**Layout da fonte (confirmado pelo usuário):** na planilha do import em lote, os acolhimentos
vêm em **colunas repetidas** numa única linha por filho — pares `Entrada 1 / Saída 1`,
`Entrada 2 / Saída 2`, ... A nota do usuário: quando há várias datas de entrada, provavelmente há
as datas de saída correspondentes na planilha (cada par = um acolhimento fechado, exceto talvez o
mais recente que pode estar em aberto).

**Campos de topo do resident (confirmado):** refletem o acolhimento **mais recente** (maior
`entryDate`). Os acolhimentos anteriores viram apenas histórico (`Admission`).

**Estado atual mapeado:**
- `spreadsheet-parser.service.ts`: `resolveColumns` mapeia **a primeira** coluna que casa cada
  alias (`HEADER_ALIASES.entryDate` / `.exitDate`) — hoje lê **um** par só. `SpreadsheetImportRow`
  carrega `entryDate`/`exitDate` únicos.
- `import.service.ts` → `commit`: cria **um** resident + **uma** `Admission` (dentro de
  `ResidentService.create`, que sempre gera 1 admission a partir do topo do resident).
- `Admission` (entity `admissions`) já modela o histórico: `entryDate`, `exitDate`, `status`,
  `houseId`. A **AdmissionsTab** (`components/tabs/AdmissionsTab.tsx`) já lista os acolhimentos do
  resident (endpoint de admissions já existe — `ResidentService` lista admissions). **Nada novo de
  UI de exibição é necessário** — basta os registros existirem.

## Desenho

### Backend — ler N pares e criar N acolhimentos

1. **`spreadsheet-parser.service.ts`** — `resolveColumns`: em vez de guardar só a 1ª coluna de
   `entryDate`/`exitDate`, **coletar todas** as colunas que casam cada alias, em ordem de coluna.
   Parear por índice → lista de acolhimentos `{ entryDate, exitDate }[]` (saída pode faltar no
   último). Ordenar por `entryDate`.
   - `SpreadsheetImportRow` ganha `admissions: { entryDate: string; exitDate: string | null }[]`.
   - Manter `entryDate`/`exitDate` de topo = os do acolhimento **mais recente** (compat + topo do
     resident e cross-match/contribuições atuais inalterados).

2. **Tipos (`packages/types`)** — adicionar `admissions` a `SpreadsheetImportRow`,
   `ParseDocxResident`/`preview.resident` (opcional) e ao payload de commit (`CommitImportDto`),
   como `ImportAdmissionDto { entryDate, exitDate? }[]`. Rodar `pnpm build:types`.

3. **`import-match.service.ts`** — propagar `row.admissions` para `preview.resident.admissions`
   (análogo ao que já faz com `entryDate`/`exitDate`, mantendo os warnings de divergência).

4. **`import.service.ts` → `commit`** — quando `dto.resident.admissions` tiver **> 1** item:
   - O resident é criado com o topo = acolhimento mais recente (status já derivado pela **story
     120**). `ResidentService.create` gera a `Admission` do acolhimento mais recente (como hoje).
   - Inserir as **admissions anteriores** (todas menos a mais recente) como `Admission` extras,
     cada uma com `status` derivado por `monthsBetween(entry, exit)` (regra dos 6 meses da story
     120: ≥6m → `DISCHARGED`, <6m → `EVADED`; acolhimento fechado sempre tem saída).
   - Tudo na mesma transação do commit (atômico, como já é).
   - Sem `admissions` ou com 1 só → comportamento atual (uma admission).

### Frontend — visibilidade no review (sem edição complexa)

- No preview de import (modal do lote `ImportFichaModal` e, quando presente, `ImportReviewStep`),
  exibir um bloco **read-only "Acolhimentos detectados"** listando os pares entrada→saída (com o
  status que será derivado), reusando o padrão do `ImportContributionHistory`. Informativo — a
  criação dos registros acontece no commit (backend). Editar N acolhimentos no formulário fica
  **fora de escopo**.
- Nenhuma mudança na exibição pós-import: a `AdmissionsTab` já lista os acolhimentos.

## Validação

Camadas tocadas: **backend (test:api)** + **tipos (build)** + **frontend adm.fonte (vitest)**.

- **`spreadsheet-parser.service.spec.ts`** (estender): planilha com pares repetidos
  (`Entrada 1/Saída 1/Entrada 2/Saída 2`) → `row.admissions` com 2 itens ordenados; topo =
  mais recente. Um par só → `admissions` com 1 item. Sem saída no último par → `exitDate: null`.
- **`import-match.service.spec.ts`** (estender): `admissions` propagado para `preview.resident`.
- **`import.service.spec.ts`** (estender): commit com 2 acolhimentos → cria 2 `Admission`
  (a mais recente via `create` + a anterior via insert), cada uma com status derivado correto
  (≥6m `DISCHARGED`, <6m `EVADED`); topo do resident = mais recente. 1 acolhimento → 1 admission
  (regressão). Transação: falha no meio não deixa admission órfã.
- **Frontend** (`ImportFichaModal.test.tsx` / componente novo): bloco "Acolhimentos detectados"
  renderiza os pares e o status previsto.

**Gate de cobertura (obrigatório):** código novo sem teste não fecha a story.
`pnpm test:api:cov` + runner de cobertura do adm.fonte (`--coverage`), ≥90% do código
novo/alterado. Sem `skip`/`only`/`xfail` injustificado. `pnpm build:types` (contrato alterado) e
`pnpm build:api-client` se o api-client reexportar os tipos. **Atualizar
`fonte-api.postman_collection.json`** se o body do commit ganhar `admissions` (documentar o novo
campo no request do endpoint de commit).

## Fora de escopo

- **Story 122** (alerta de conflito falso pós-aprovação) — item separado.
- Editar/remover acolhimentos individualmente no formulário de import — só criação a partir da
  planilha + exibição read-only.
- Distribuir as contribuições/carnê **por acolhimento** — as contribuições continuam ligadas ao
  resident como hoje (histórico único). Split por período fica para outra story.
- Múltiplas datas vindas da **ficha docx** (célula com N datas) — o docx continua colapsando na
  mais recente + warning (comportamento atual); a fonte de múltiplos acolhimentos é a planilha.
- CRUD manual de acolhimentos fora do import.
