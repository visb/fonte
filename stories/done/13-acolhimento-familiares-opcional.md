# Plan: Acolhimento — permitir avançar da aba "Familiares" sem cadastrar familiar

## Context

No wizard de acolhimento (`AdmissionWizardPage`), a etapa 2 (**Familiares**) bloqueia o avanço enquanto não houver pelo menos um familiar cadastrado. Regra de negócio atual em `BUSINESS_RULES.md` exige Relative, mas o fluxo de acolhimento deve permitir registrar o familiar depois. Liberar o avanço mesmo sem familiar.

### Decisão

Esta story relaxa **apenas o gate de navegação do wizard** no frontend. O backend hoje **não** bloqueia criar/ativar residente sem Relative (o gate é só de UI). Nenhuma mudança de backend nem de `BUSINESS_RULES.md`: o familiar pode ser cadastrado depois pela aba Familiares do filho. A redação de `BUSINESS_RULES.md` permanece como referência de objetivo, não como bloqueio rígido no acolhimento.

---

## Arquivo

`apps/adm.fonte/src/features/residents/pages/AdmissionWizardPage.tsx`

---

## Mudanças

### 1. `handleNext` — remover gate `hasRelative`

```tsx
// antes
if (step === 2 && hasRelative) {
  setStep(3);
}

// depois
if (step === 2) {
  setStep(3);
}
```

### 2. `nextDisabled` — remover condição de familiar

```tsx
// antes
const nextDisabled =
  advancing ||
  (step === 2 && !hasRelative) ||
  (isLast && !allDocsSigned);

// depois
const nextDisabled =
  advancing ||
  (isLast && !allDocsSigned);
```

### 3. Texto auxiliar da etapa 2

Trocar o texto imperativo por opcional:

```tsx
// antes
<p className="text-sm text-muted-foreground">
  Cadastre pelo menos um familiar para continuar.
</p>

// depois
<p className="text-sm text-muted-foreground">
  Cadastre os familiares do acolhido. Você pode adicioná-los depois, se necessário.
</p>
```

`hasRelative` pode ficar sem uso após isso — remover a variável se o lint acusar.

---

## Testes automatizados (obrigatório — Definition of Done)

Story só conclui com testes automatizados verdes cobrindo o novo comportamento.

| Arquivo | Caso |
| --- | --- |
| `apps/adm.fonte/e2e/residents.spec.ts` | Wizard de acolhimento: chegar na aba **Familiares** sem cadastrar nenhum e confirmar que **Avançar** está habilitado e navega para **Documentos** |
| `apps/adm.fonte/e2e/residents.spec.ts` | (regressão) avançar com familiar cadastrado ainda funciona |

Rodar: `pnpm test:adm`. Verdes.

## Verificação manual

1. `pnpm dev:adm` — iniciar acolhimento, chegar na aba Familiares sem cadastrar nenhum, botão **Avançar** habilitado e leva à etapa Documentos.
2. Cadastrar familiar mesmo assim ainda funciona normalmente.
