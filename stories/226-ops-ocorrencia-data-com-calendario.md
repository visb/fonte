# Plan: ops — campo data da nova ocorrência com calendário

## Context

Bloco do BACKLOG: "no app ops, nova ocorrência" (itens 226–230 refinam o mesmo formulário).

Hoje o campo **Data** de `NewIncidentPage` é um `TextInput` cru com placeholder `AAAA-MM-DD`
(`apps/ops.fonte/features/incidents/components/IncidentFormFields.tsx`). O operador tem que digitar a
data em formato ISO, sem máscara nem validação — erro fácil e lento em campo.

O ops já tem o componente certo: `components/shared/DateInput.tsx` (story 209) — máscara
`dd/mm/aaaa` + ícone que abre o `DatePickerModal`, sempre emitindo ISO. Basta adotar.

Decisões travadas:

- Reusar `DateInput`; **não** criar picker novo.
- `maxDate = hoje`: ocorrência registra o que já aconteceu, nunca data futura. Schema também rejeita
  futura (digitação não passa pelo limite do calendário).
- Default continua **hoje**.
- Contrato do payload (`date` ISO `aaaa-mm-dd`) e a fila offline (`incidents/create`) **não mudam**.

## Desenho

- `IncidentFormFields.tsx`: substituir o `TextInput` do campo `date` por
  `<DateInput value onChange onBlur maxDate={today} accessibilityLabel="Data" error={errors.date?.message} />`
  dentro do `Controller`.
- `NewIncidentPage.tsx` (schema zod): `date` obrigatória, ISO válida, `<= hoje`, com mensagens em
  pt-BR ("Informe a data", "Data não pode ser futura"). Calcular `today` em fuso local (hoje usa
  `toISOString()`, que vira o dia seguinte depois das 21h em BRT) — reaproveitar helper de
  `lib/date` se existir, senão criar lá.
- Exibir erro do campo data (hoje não exibe).

## Validação

- **Unit (ops, jest):** `IncidentComponents.test.tsx` — campo data renderiza `DateInput`
  (label "Data", ícone "Abrir calendário: Data"); escolher data no picker preenche o form; erro
  do schema aparece. Teste do schema: vazia, inválida, futura → erro; hoje e passada → ok.
  Teste do helper de "hoje local" (virada 21h BRT).
- **Fila offline:** `fieldFlows.test.tsx` / `mutationDefaults.test.ts` seguem verdes (payload
  inalterado).
- **E2E (Maestro):** atualizar `apps/ops.fonte/e2e/incidents.yaml` para preencher a data via
  campo mascarado (`dd/mm/aaaa`).
- **Gate de cobertura:** código novo sem teste não fecha a story. `pnpm test:ops:unit` com
  cobertura (≥90% do escopo tocado). Sem `skip`/`only`/`xfail` injustificado.

## Fora de escopo

- Hora da ocorrência (só data).
- Mudar o campo data em outros fluxos do ops.
- Demais campos do formulário (stories 227–230).
