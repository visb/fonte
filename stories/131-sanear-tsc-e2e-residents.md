# Plan: Sanear o build e o e2e de `features/residents` (regressões pré-existentes)

## Context

A feature `features/residents` do `adm.fonte` está **quebrada na `main`** por regressões que **não**
foram introduzidas pela rodada 125–130 — foram confirmadas idênticas na `main` limpa (via `git
stash -u`) durante a implementação das stories 128, 129 e 130. Como toda story que toca `residents`
esbarra nelas, elas mascaram regressões novas e forçam cada implementer a distinguir "falha minha" de
"falha herdada" manualmente. Esta story **zera essa dívida** para que a suíte de `residents` volte a
ser um sinal confiável.

### Sintomas confirmados (medidos em 2026-07-18, ponta da `main`)

**1. `tsc -b` do `adm.fonte` — 4 erros, todos em `features/residents`:**

```
src/features/residents/components/tabs/ContributionsTab.tsx(34,54): TS2345: 'string | null' não atribuível a 'string'
src/features/residents/components/tabs/ContributionsTab.tsx(77,9):  TS2322: 'string | null' não atribuível a 'string'
src/features/residents/hooks/useBulkImport.ts(388,89):             TS2554: Expected 2 arguments, but got 3
src/features/residents/lib/residentSchema.ts(102,5):              TS2322: 'string | null' não atribuível a 'string | undefined'
```

**Causa raiz (3 dos 4):** a migration `1783036900000-AllowNullResidentHouse` tornou `house_id`
anulável e o contrato `Resident.houseId` passou a `string | null` (filho `ARCHIVED` fica sem casa —
`BUSINESS_RULES.md`). O código consumidor ainda assume `string`:
- `ContributionsTab.tsx:34` — `resident.houseId` entra em `useInventoryCatalog(houseId: string)`.
- `ContributionsTab.tsx:77` — `houseId={resident.houseId}` na prop do `RegisterPaymentDialog`.
- `residentSchema.ts:102` — `houseId: r.houseId` em `residentToFormValues`, onde `ResidentFormData.houseId`
  é `string | undefined`.

**Causa raiz (o 4º, independente):** `useBulkImport.ts:388` chama
`buildCommitPayloadFromPreview(item.preview!, housesRef.current, item.fileName)` com **3** argumentos,
mas a assinatura atual aceita **2** — drift entre a chamada e a função (o 3º arg `fileName` foi
adicionado na chamada sem entrar na assinatura, ou removido da assinatura sem atualizar a chamada).

**2. `pnpm test:adm` (Playwright) — `residents.spec.ts` 6 failed / 22 passed** (baseline na `main`
limpa, idêntico com e sem o diff das stories da rodada). Os 6 fluxos que falham:
- criar residente **via gateway**;
- **editar** residente;
- aba **Histórico** (wizard);
- **DISCHARGED → Reintroduzir**;
- **gateway de reintrodução**;
- aba **Contribuição** — declarar produtos **sem dinheiro**.

Nenhum toca ordenação/preferências/assinatura (o que a rodada mexeu). Os `toBeVisible`/`selectOption`
dão timeout — cheira a mudança de markup/fluxo não refletida no spec, ou dado de seed ausente.

### Decisões / diretrizes

1. **Corrigir no ponto certo, não silenciar o tipo.** `houseId` É legitimamente anulável agora. Os
   três erros de `tsc` se resolvem **tratando o `null`** (ex.: `RegisterPaymentDialog`/`useInventoryCatalog`
   não fazem sentido sem casa → gate/guard, ou aceitar `string | null` e desabilitar a ação quando
   nulo), **nunca** com `as string` nem `!`. O comportamento correto para filho sem casa na aba de
   Contribuição precisa ser decidido na implementação (provavelmente: sem casa ⇒ sem carnê/plano ⇒
   estado vazio já existente), coerente com "filho `ARCHIVED` fica fora de listagens/contagens por casa".
2. **`useBulkImport.ts:388` é bug de contrato de função** — alinhar chamada e assinatura de
   `buildCommitPayloadFromPreview` (decidir se `fileName` é usado; se sim, entra na assinatura e no
   corpo; se não, sai da chamada). Cobrir com teste.
3. **Os 6 e2e são investigação:** a implementação diagnostica cada um (markup mudou? seletor frágil?
   dado de seed? regra de negócio?), conserta o fluxo **ou** o spec, e deixa `residents.spec.ts`
   **verde**. Se algum depender de correção de seed que colide com a **story 132** (skips do seed),
   coordenar — mas o alvo aqui é os 6 do `residents.spec.ts`, não os 2 skips de bible-courses.
4. **Escopo é saneamento, não feature.** Nenhum comportamento novo de produto; só restaurar
   build + e2e verdes em `residents`.

## Desenho

- **`adm.fonte`:**
  - `ContributionsTab.tsx` — tratar `resident.houseId` nulo nos pontos 34 e 77 (guard/gate + estado
    vazio coerente; sem cast).
  - `residentSchema.ts` — `residentToFormValues` normaliza `houseId` nulo (`r.houseId ?? undefined`
    ou `?? ''`, conforme o schema do form; garantir que o form de edição não quebra para filho sem casa).
  - `useBulkImport.ts` + `buildCommitPayloadFromPreview` — reconciliar assinatura×chamada.
  - `e2e/residents.spec.ts` (e/ou os componentes/fluxos que ele exercita) — corrigir os 6 cenários.
- **Sem backend, sem migration, sem contrato novo** (a menos que a investigação do e2e revele um bug
  real de API — se revelar, é `test:api`/`test:api:e2e` também). Não editar migration aplicada.

## Validação

- **`pnpm --filter adm.fonte exec tsc -b`** (ou `pnpm build:adm`): **0 erros** — os 4 acima somem e
  nenhum novo aparece.
- **`pnpm test:adm:unit`** (Vitest): mantém verde; **cobrir com unit os ramos novos de null-handling**
  — `ContributionsTab` com `resident.houseId === null` (renderiza estado coerente, não crasha, não
  chama `useInventoryCatalog`/abre pagamento com casa nula); `residentToFormValues` com `houseId`
  nulo devolve valor válido para o form; `buildCommitPayloadFromPreview` com a aridade corrigida
  produz payload esperado (inclui/omite `fileName` conforme a decisão).
- **`pnpm test:adm`** (Playwright): `residents.spec.ts` **verde** — os 6 fluxos (criar via gateway,
  editar, aba Histórico, DISCHARGED→Reintroduzir, gateway reintrodução, Contribuição sem dinheiro)
  passam de verdade. Rodar a suíte inteira para garantir zero regressão colateral.
- Se a investigação tocar backend: **`pnpm test:api`** (+ `pnpm test:api:e2e` se houver fluxo HTTP).
- **Baseline honesto:** documentar no commit o antes (`6 failed`) e o depois (`0 failed`) e, para
  cada um dos 6, a causa e o conserto (fluxo vs spec).

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado (os guards de null e a
> correção de aridade) tem teste correspondente — nenhum código novo entra sem teste. Rodar
> `pnpm test:adm:unit:cov`; **não reduzir** a cobertura de `features/residents`. Sem
> `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- **Os 2 skips do seed** em bible-courses/story-99 (`eligible-residents` volta `[]` porque o filho do
  seed tem `entry_date` = hoje) — é a **story 132**.
- Refatorar `useBulkImport`/import de filhos além do conserto de aridade.
- Qualquer feature nova em `residents` (ordenação, filtros, etc. — já entregues nas 129/130).
- Reescrever `residents.spec.ts` do zero — só consertar os 6 fluxos quebrados.
