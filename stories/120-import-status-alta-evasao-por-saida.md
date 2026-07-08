# Plan: Aprovar filho que já saiu → status ALTA/EVASÃO + data de saída

## Context

Bloco do BACKLOG: **melhorias no import de filhos** (fichas via IA + planilha em lote).
Contexto compartilhado com as stories 119, 121, 122 (mesmo fluxo de importação/aprovação).

**Bug relatado:** ao aprovar o import de um filho que **já saiu** da comunidade, o cadastro
sai com status **ATIVO** e **sem data de saída** — errado. O correto:

- Gravar a `exitDate`.
- Derivar o status a partir da permanência (entrada → saída):
  - permanência **≥ 6 meses** → **ALTA** (`ResidentStatus.DISCHARGED`).
  - permanência **< 6 meses** → **EVASÃO** (`ResidentStatus.EVADED`).

**Origem da data de saída (esclarecido pelo usuário):** vem **da planilha do import em lote**.
O `spreadsheet-parser` já extrai a coluna de saída (`HEADER_ALIASES.exitDate`:
`data de saida | saida | desligamento`) e o `import-match.service` já injeta em
`preview.resident.exitDate` (com warning de divergência ficha×planilha). **O dado chega íntegro
até o preview** — ele só se perde a partir daí.

**Onde a saída se perde hoje (mapeado):**
1. `apps/adm.fonte/.../lib/importCommit.ts` → `FORM_KEYS` **não inclui `exitDate`**, então
   `previewToFormValues` descarta a data ao pré-carregar o form (afeta o modal do lote e a
   aprovação direta pelo card via `buildCommitPayloadFromPreview`).
2. `lib/residentSchema.ts` **não tem campo `exitDate`** — o form nem carrega/edita a data.
3. `buildCommitPayload` força `status: (formValues.status) || ResidentStatus.ACTIVE` — nunca
   deriva ALTA/EVASÃO.
4. Backend: `ResidentService.create` persiste `dto.status` como veio; ninguém deriva o status.

**Decisão de design (travada):** a derivação ALTA/EVASÃO fica no **backend**, no
`ImportService.commit` — cobre os três caminhos de commit (modal do lote, card direto, ficha IA),
é lógica de negócio (pertence ao service) e é testável em `test:api`. O frontend só precisa
**deixar de perder** a `exitDate` e mostrá-la editável.

## Desenho

### Backend — derivação no commit (fonte da verdade)

`services/api/src/modules/resident/import.service.ts` → `commit`:

- Antes de `residentService.create`, se `dto.resident.exitDate` estiver presente **e**
  `dto.resident.entryDate` também, derivar o status quando o status recebido for
  **não-terminal** (`ACTIVE` / `PRE_ADMISSION` / ausente) — um filho com data de saída não pode
  ficar ATIVO:
  - `monthsBetween(entryDate, exitDate) >= 6` → `ResidentStatus.DISCHARGED`.
  - caso contrário → `ResidentStatus.EVADED`.
- Se o operador **escolheu explicitamente** um status terminal (`DISCHARGED`/`EVADED`) no modal
  do lote, **respeitar** a escolha (não sobrescrever) — só derivar quando o status for o default
  ATIVO/pré-admissão.
- `exitDate` já é aceito pelo `CreateResidentDto` e copiado para o `Admission` em `create`
  (`exitDate: saved.exitDate`, `status: saved.status`) — nada a mudar lá.

Helper de meses (novo, no módulo resident — ex: `common/lib` ou util do próprio service):

```ts
/** Meses completos entre duas datas ISO (exit < entry → 0). */
export function monthsBetween(startIso: string, endIso: string): number {
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  let months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  if (e.getUTCDate() < s.getUTCDate()) months -= 1; // mês incompleto no fim não conta
  return Math.max(0, months);
}
```

Borda `entryDate` ausente + `exitDate` presente: não há como derivar permanência → manter o
status recebido (não inventar) — caso raro, resolvido manualmente depois.

### Frontend — parar de perder a `exitDate` e torná-la editável

`apps/adm.fonte/src/features/residents`:

1. `lib/importCommit.ts` → adicionar `'exitDate'` a `FORM_KEYS` (carrega do preview p/ o form).
2. `lib/residentSchema.ts` → adicionar `exitDate: z.string().optional()` ao `residentSchema`;
   incluir em `residentToFormValues` (`exitDate: dateStr(r.exitDate)`); `buildResidentPayload`
   já trata string→null genericamente.
3. `components/ResidentFormSections.tsx` → renderizar input **"Data de saída"** (`type=date`)
   ao lado da data de entrada, condicionado a uma prop `showExitDate` (ligada no contexto de
   import), para não poluir o cadastro normal.
4. Ligar `showExitDate` nos dois pontos de import: `ImportReviewStep` (IA) e `ImportFichaModal`
   (lote). Manter `buildCommitPayload` enviando `exitDate`; o `status || ACTIVE` pode
   permanecer — o backend deriva por cima quando há saída.

## Validação

Camadas tocadas: **backend (test:api)** + **frontend adm.fonte (vitest)**.

- **`import.service.spec.ts`** (estender): commit com `exitDate` e `entryDate`:
  - permanência ≥ 6 meses + status ausente/ACTIVE → resident e admission gravados `DISCHARGED`
    com `exitDate`.
  - permanência < 6 meses → `EVADED` com `exitDate`.
  - status explícito `DISCHARGED`/`EVADED` no dto → preservado (não re-derivado).
  - `exitDate` sem `entryDate` → status recebido mantido, sem crash.
  - sem `exitDate` → comportamento atual (status como veio).
- **`monthsBetween`** — spec unitário: 6 meses exatos = 6; 5 meses e 29 dias = 5; exit < entry = 0;
  viradas de ano.
- **`importCommit.test.ts`** (estender): `previewToFormValues` com `exitDate` no preview →
  presente no form values.
- **`residentSchema`** — `exitDate` aceito; `residentToFormValues` mapeia `r.exitDate`.
- **`ResidentFormSections` / `ImportFichaModal` / `ImportReviewStep`** (estender testes): com
  `showExitDate`, input "Data de saída" aparece e edita.

**Gate de cobertura (obrigatório):** código novo sem teste não fecha a story.
`pnpm test:api:cov` (backend) + runner de cobertura do adm.fonte (`--coverage`), ≥90% do código
novo/alterado. Sem `skip`/`only`/`xfail` injustificado. Atualizar
`fonte-api.postman_collection.json` **não** é necessário — nenhum endpoint muda (só a lógica
interna do commit; o `exitDate`/`status` já fazem parte do body do commit existente).

## Fora de escopo

- Import de **múltiplos acolhimentos** a partir de várias datas de entrada — é a **story 121**
  (esta story trata de **uma** entrada + **uma** saída).
- Alterar a regra geral de transição de status fora do import (fluxo de alta/evasão normal via
  `ResidentService.update` fica intacto).
- Extrair `exitDate` da ficha via IA (docx) — a fonte confirmada é a planilha; o campo editável
  cobre o caso de a saída não vir na planilha.
- Reprocessar/retroagir imports já aprovados com status errado — correção manual.
