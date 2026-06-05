# Plan: Ao finalizar acolhimento, redirecionar para detalhes do filho na aba "Visão geral"

## Context

Ao concluir o wizard de acolhimento (`AdmissionWizardPage.handleFinish`), o redirect é `navigate(\`/residents/${residentId}\`)`. A `ResidentDetailPage` usa `?tab=...` para selecionar a aba (default `overview` quando ausente). O requisito é redirecionar explicitamente para a aba **Visão geral** (`overview`).

Sem `?tab`, a página já cai em `overview` por default — mas tornar explícito garante o comportamento e evita herdar query params residuais.

---

## Arquivo

`apps/adm.fonte/src/features/residents/pages/AdmissionWizardPage.tsx`

## Mudança

```tsx
// antes
navigate(`/residents/${residentId}`);

// depois
navigate(`/residents/${residentId}?tab=overview`);
```

> Referência do roteamento de abas: `ResidentDetailPage.tsx` —
> `const activeTab = (searchParams.get('tab') as TabId | null) ?? 'overview';`

---

## Testes automatizados (obrigatório — Definition of Done)

Story só conclui com teste automatizado verde cobrindo o redirect.

| Arquivo | Caso |
| --- | --- |
| `apps/adm.fonte/e2e/residents.spec.ts` | Concluir wizard de acolhimento → URL final = `/residents/:id?tab=overview` e a aba **Visão geral** está ativa/visível |

Rodar: `pnpm test:adm`. Verde.

## Verificação manual

1. `pnpm dev:adm` — concluir um acolhimento; cai na página de detalhes do filho com a aba **Visão geral** ativa.
