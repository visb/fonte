# Plan: Tela de confirmação da importação por IA deve mostrar TODOS os dados preenchidos

## Context

No wizard de importar filho com IA (`ImportResidentPage` → `ImportSummaryStep`), a tela final de confirmação só exibe um subconjunto dos campos: `name`, `cpf`, `birthDate`, `entryDate`, `addiction`. As abas anteriores (`ImportReviewStep`) coletam muito mais (ficha completa + admissão: casa, telefone, endereço, escolaridade, modalidade de contribuição, datas, observações, etc.). A confirmação fica imprecisa — o usuário não vê o que de fato será salvo.

Requisito: mostrar todos os dados informados de forma organizada por seção.

---

## Arquivos

| Arquivo | Mudança |
| --- | --- |
| `apps/adm.fonte/src/features/residents/components/import/ImportSummaryStep.tsx` | Exibir resumo completo, agrupado |
| `apps/adm.fonte/src/features/residents/lib/residentSchema.ts` | Reusar `FICHA_FIELDS` / `ADMISSAO_FIELDS` e labels para iterar campos |

---

## Estratégia

Evitar listar campo a campo manualmente (frágil). Definir um mapa de exibição reutilizável (label + formatter) cobrindo todos os campos de `ResidentFormData`, agrupado em **Ficha** e **Admissão**, espelhando as seções de `ResidentFormSections.tsx`. Renderizar apenas os campos com valor.

### 1. Mapa de labels/seções

Centralizar em `features/residents/constants.ts` (ou novo `summaryFields.ts`):

```typescript
type FieldDef = { key: keyof ResidentFormData; label: string; format?: (v: unknown) => string };

export const RESIDENT_SUMMARY_SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Ficha de cadastro',
    fields: [
      { key: 'name', label: 'Nome' },
      { key: 'cpf', label: 'CPF' },
      { key: 'birthDate', label: 'Nascimento', format: formatDate },
      { key: 'addiction', label: 'Dependência' },
      // ... todos os campos da ficha
    ],
  },
  {
    title: 'Admissão',
    fields: [
      { key: 'entryDate', label: 'Entrada', format: formatDate },
      { key: 'houseId', label: 'Casa', format: (v) => houseName(v) },
      { key: 'familyInvestment', label: 'Modalidade', format: (v) => FAMILY_INVESTMENT_LABELS[v] },
      { key: 'familyInvestmentAmount', label: 'Valor', format: (v) => `R$ ${v}` },
      // ... todos os campos de admissão
    ],
  },
];
```

> Conferir a lista real de campos em `ResidentFormData` (`residentSchema.ts`) e nas seções de `ResidentFormSections.tsx` para não omitir nenhum. `houseId` precisa resolver o nome da casa — passar `houses` (já disponível no wizard) para o step.

### 2. `ImportSummaryStep.tsx`

Substituir as `<SummaryRow>` manuais por iteração sobre `RESIDENT_SUMMARY_SECTIONS`, renderizando só campos com valor:

```tsx
{RESIDENT_SUMMARY_SECTIONS.map((section) => {
  const rows = section.fields
    .map((f) => ({ label: f.label, value: formatValue(residentValues[f.key], f.format) }))
    .filter((r) => r.value);
  if (!rows.length) return null;
  return (
    <section key={section.title} className="rounded-lg border p-4 space-y-2">
      <h3 className="text-sm font-medium">{section.title}</h3>
      {rows.map((r) => <SummaryRow key={r.label} label={r.label} value={r.value} />)}
    </section>
  );
})}
```

Manter as seções existentes de **Familiares**, **Foto** e **Arquivos a anexar**.

### 3. Prop `houses`

`ImportSummaryStep` precisa de `houses` para resolver `houseId → name`. Passar do `ImportResidentPage` (já carrega `useHouses`? confirmar; senão adicionar).

---

## Testes automatizados (obrigatório — Definition of Done)

Story só conclui com teste automatizado verde cobrindo o resumo completo.

| Arquivo | Caso |
| --- | --- |
| `apps/adm.fonte/e2e/residents.spec.ts` | Fluxo de importar com IA: preencher campos além do subconjunto antigo (casa, modalidade, endereço, etc.); na tela de confirmação assertar que esses campos aparecem com label e valor legível (nome da casa, não UUID; label da modalidade, não enum) |
| `apps/adm.fonte/e2e/residents.spec.ts` | Campo deixado vazio **não** renderiza linha no resumo |

> Decisão: `adm.fonte` só tem E2E Playwright (sem infra de teste de componente unitário). Cobertura desta story é **via Playwright**. Se `RESIDENT_SUMMARY_SECTIONS`/`formatValue` virarem funções puras isoladas, um teste de unidade fica como melhoria futura — não bloqueia esta story.

Rodar: `pnpm test:adm`. Verde.

## Verificação manual

1. `pnpm dev:adm` — importar filho com IA preenchendo vários campos nas abas; tela de confirmação lista todos os campos preenchidos, agrupados em Ficha e Admissão, com casa e modalidade legíveis (não IDs/enums crus).
2. Campos vazios não aparecem (sem linhas em branco).
3. Confirmar e salvar cria o residente com os dados mostrados.
