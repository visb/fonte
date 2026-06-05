# Plan: Acolhimento — habilitar "Concluir acolhimento" sem upload de documentos

## Context

Na etapa final (**Documentos**) do `AdmissionWizardPage`, o botão **Concluir acolhimento** só habilita quando todos os documentos obrigatórios estão assinados (`allDocsSigned`). Requisito: permitir concluir mesmo sem upload de documento algum. Os documentos podem ser anexados depois pela aba Anexos do filho.

---

## Arquivo

`apps/adm.fonte/src/features/residents/pages/AdmissionWizardPage.tsx`

---

## Mudanças

### 1. `handleFinish` — remover gate `allDocsSigned`

```tsx
// antes
const handleFinish = async () => {
  if (!residentId || !allDocsSigned) return;
  ...
};

// depois
const handleFinish = async () => {
  if (!residentId) return;
  ...
};
```

### 2. `nextDisabled` — remover condição de docs

```tsx
// antes
const nextDisabled =
  advancing ||
  (isLast && !allDocsSigned);

// depois
const nextDisabled = advancing;
```

(combinar com a remoção do gate de familiares da story 13 — resultado final: `const nextDisabled = advancing;`)

### 3. Texto auxiliar da etapa 3

```tsx
// antes
<p className="text-sm text-muted-foreground">
  Gere e envie assinado todos os documentos obrigatórios de acolhimento para concluir.
</p>

// depois
<p className="text-sm text-muted-foreground">
  Gere e anexe os documentos assinados. Você pode concluir agora e anexá-los depois.
</p>
```

### Decisão — manter aviso não-bloqueante

**Manter** `allDocsSigned`/`requiredTemplates`/`signedMap` e usar para exibir um aviso visual **não-bloqueante** acima do botão quando houver documentos obrigatórios pendentes. Não remover essas variáveis.

```tsx
{!allDocsSigned && (
  <p className="text-sm text-amber-600 pt-2">
    Há documentos obrigatórios pendentes. Você pode concluir agora e anexá-los depois.
  </p>
)}
```

---

## Testes automatizados (obrigatório — Definition of Done)

Story só conclui com testes automatizados verdes cobrindo o novo comportamento.

| Arquivo | Caso |
| --- | --- |
| `apps/adm.fonte/e2e/residents.spec.ts` | Wizard: chegar na etapa **Documentos** sem assinar nenhum doc → botão **Concluir acolhimento** habilitado; concluir → residente fica `ACTIVE` |
| `services/api/test/residents.e2e-spec.ts` | `PATCH /residents/:id { status: ACTIVE }` sem documentos assinados é aceito (sem regra de negócio bloqueando) |

Rodar: `pnpm test:adm` e `pnpm test:api:e2e`. Verdes.

## Verificação manual

1. `pnpm dev:adm` — chegar na etapa Documentos sem assinar nada, botão **Concluir acolhimento** habilitado e finaliza (status → `ACTIVE`).
2. Anexar documento ainda funciona normalmente.
