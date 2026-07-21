# Plan: Corrigir e2e de contas a pagar quebrado por drift de data de vencimento

## Context

Falha e2e **pré-existente** descoberta na story 132 e reconfirmada na retomada de 133/134
(2026-07-21). Não é regressão de nenhuma story recente — é uma **data fixa que envelheceu**.

`apps/adm.fonte/e2e/payables.spec.ts:44` ("cria uma conta a pagar e ela aparece na lista") falha:

```
Locator: getByRole('row', { name: /Conta Luz .../ }).getByText('Em aberto')
Expected: visible — element(s) not found
```

### Causa raiz (investigada)

- O helper `createPayable` (payables.spec.ts:13-27) cria a conta com **vencimento fixo
  `2026-06-20`**.
- A conta é criada com sucesso (a `cell` da descrição aparece), mas o teste então afirma o status
  **"Em aberto"** na linha.
- Hoje (2026-07-21) `2026-06-20` está **no passado** → o backend marca `payable.overdue = true`.
- `PayableStatusBadge` (`src/features/payables/components/PayableStatusBadge.tsx`) renderiza, para
  `overdue && status === OPEN`, o badge **"Vencida"** (derivado, não persistido) em vez de
  "Em aberto". Logo o texto "Em aberto" não existe na linha → assert falha.

É a **mesma classe de bug** que o aviso da story 132: *datas de teste devem ser relativas ao "agora",
nunca fixas*. Nenhum defeito de produto — o badge "Vencida" está correto; o teste é que congelou uma
data que virou passado.

### Decisões / diretrizes

1. **Teste-only.** Não há mudança de produção. O comportamento "Em aberto" vs "Vencida" está certo.
2. **Vencimento relativo ao agora.** `createPayable` deve gerar o vencimento como **data futura
   relativa** (ex.: hoje + 30 dias) para que a conta nasça **OPEN não-vencida** e o badge seja
   "Em aberto", validando o cenário que o teste quer cobrir.
3. **Varredura por outras datas fixas no spec.** Conferir os demais testes de `payables.spec.ts`
   (ex.: filtros por status, detalhe, marcar como paga) e corrigir qualquer outra data fixa que possa
   drift-ar; se algum teste PRECISA de uma conta vencida, gerar vencimento **no passado relativo**
   (hoje − N dias), também relativo — nunca literal.
4. **Não mascarar com data fixa nova.** Proibido só trocar `2026-06-20` por outra data literal futura
   — isso só adia o mesmo bug. Tem que ser computada a partir de `new Date()`/`Date.now()`.

## Desenho

- **`apps/adm.fonte/e2e/payables.spec.ts`**
  - `createPayable`: aceitar/gerar `dueDate` relativo (default = hoje + 30 dias, formatado
    `YYYY-MM-DD` no fuso do input) em vez de `'2026-06-20'`.
  - Ajustar chamadas que dependem do status resultante. Para casos que exijam conta **vencida**,
    passar um vencimento no passado relativo.
- **Sem mudança de produção** (nenhum arquivo em `src/`), salvo se a varredura revelar um bug real de
  cálculo de `overdue` (improvável — o backend deriva por comparação de data).

## Validação

Gate (story e2e-only): **e2e verde e determinístico**, sem `skip`/`only`/`xfail` injustificado.
Como não toca produção, não há gate de cobertura unit.

- `pnpm test:adm` — `payables.spec.ts` **inteiro verde** (todos os cenários, não só o :44).
- Rodar 2× (ou em ordem embaralhada) provando que não depende do relógio de forma frágil (a data é
  relativa, então passa hoje e continuará passando no futuro).
- Suíte e2e adm sem regressão nos demais specs.
- Se a varredura corrigir outros testes de data fixa, todos verdes.

## Fora de escopo

- Falha e2e de `activities.spec.ts` (WYSIWYG negrito) — é a **story 143** (bug de produto distinto).
- Lógica de produção de contas a pagar (status/overdue/badge) — está correta; não mexer.
- Introduzir status "Vencida" persistido — é derivado de propósito; fora de escopo.
