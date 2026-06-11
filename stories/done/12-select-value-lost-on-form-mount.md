# Plan: Campo `<select>` perde valor quando opções carregam após `reset()`

## Context

Ao editar um servo (`EditStaffPage`), o campo **Casa** abre vazio mesmo quando o servo tem casa. Causa raiz: o `<select>` nativo só mantém `value` se existir um `<option>` correspondente no momento em que o valor é aplicado. O `reset(staffToFormValues(staff))` roda no `useEffect` quando `staff` carrega, mas a lista de casas (`useHouses()`) é uma query separada que pode resolver **depois**. Quando o `reset` aplica `houseId`, ainda não há `<option>` daquela casa → o browser descarta o valor.

Mesmo padrão existe em outras telas. Precisamos corrigir e **auditar todos os apps**.

### Telas afetadas (adm.fonte)

| Arquivo | Select dependente de query async |
| --- | --- |
| `apps/adm.fonte/src/features/staff/pages/EditStaffPage.tsx` | `houseId` (← `useHouses`), `supportGroupId` (← `useSupportGroups`) — **bug reportado** |
| `apps/adm.fonte/src/features/residents/pages/EditResidentPage.tsx` | `houseId` (← `useHouses`) — **mesmo bug** |
| `apps/adm.fonte/src/features/support-groups/components/SupportGroupDialog.tsx` | `coordinatorId` (← `useStaff`) — `reset` no `open`, staff async |

### Apps a auditar (sem mudança garantida)

- `ops.fonte` / `app.fonte`: formulários usam `Controller` + Picker/RN. `Controller` mantém o valor no estado do RHF independente das opções renderizadas, então o sintoma do `<select>` nativo **não** se aplica diretamente. Ainda assim, verificar pickers que renderizam opções a partir de query async e confirmam seleção por igualdade de `value` (ex.: `ResidentPicker`, `AddResidentModal`, `IncidentFormFields`).

---

## Root Cause Detalhada

`<select>` nativo é um componente controlado pelo DOM: ao montar/atualizar, se o `value` atual não bate com nenhum `<option>.value`, ele cai para o primeiro option (ou vazio). RHF `register('houseId')` apenas seta o `.value` do elemento; não re-aplica quando novas options aparecem. Logo a ordem de chegada das queries determina o bug.

---

## Estratégia de Correção (decidida)

- **Pages** (`EditStaffPage`, `EditResidentPage`) → **Opção A** (gate de `reset`/render por loading das queries de opções). Têm `LoadingState`, então bloquear render é aceitável e mais robusto.
- **Dialog** (`SupportGroupDialog`) → **Opção B** (re-aplicar o campo via `setValue` quando a lista chega). Dialog não tem `LoadingState` e não deve bloquear render.

### A. Adiar `reset` até que as listas de opções estejam carregadas

Incluir o estado de loading das queries de opções no gate e nas deps do effect, de forma que o `reset` só rode (ou re-rode) quando tanto a entidade quanto as opções existirem.

`EditStaffPage.tsx`:

```tsx
const { data: houses = [], isLoading: loadingHouses } = useHouses();
const { data: supportGroups = [], isLoading: loadingGroups } = useSupportGroups();
const { data: staff, isLoading } = useStaffById(id!);

useEffect(() => {
  if (staff && !loadingHouses && !loadingGroups) reset(staffToFormValues(staff));
}, [staff, loadingHouses, loadingGroups, reset]);

if (isLoading || loadingHouses || loadingGroups) return <LoadingState />;
```

`EditResidentPage.tsx`:

```tsx
const { data: houses = [], isLoading: loadingHouses } = useHouses();
...
useEffect(() => {
  if (resident && !loadingHouses) reset(residentToFormValues(resident));
}, [resident, loadingHouses, reset]);

if (loadingResident || loadingHouses) return <LoadingState />;
```

### B. Re-aplicar valor quando as opções chegam (usado no `SupportGroupDialog`)

Re-aplicar o campo específico via `setValue` quando a lista correspondente muda. No `SupportGroupDialog` o `reset` roda no `open`; adicionar effect que reaplica `coordinatorId` quando `staff` chega:

```tsx
useEffect(() => {
  if (open && group && staff.length) setValue('coordinatorId', group.coordinatorId ?? null);
}, [open, group, staff, setValue]);
```

---

## Arquivos

| Arquivo | Mudança |
| --- | --- |
| `apps/adm.fonte/src/features/staff/pages/EditStaffPage.tsx` | Gate `reset`/render por `loadingHouses`/`loadingGroups` |
| `apps/adm.fonte/src/features/residents/pages/EditResidentPage.tsx` | Gate `reset`/render por `loadingHouses` |
| `apps/adm.fonte/src/features/support-groups/components/SupportGroupDialog.tsx` | Re-aplicar `coordinatorId` quando `staff` chega (opção B) |

---

## Testes automatizados (obrigatório — Definition of Done)

Story só é considerada concluída com testes automatizados verdes que cobrem a correção. Teste de regressão deve **falhar antes do fix** e passar depois.

| Arquivo | Caso |
| --- | --- |
| `apps/adm.fonte/e2e/staff.spec.ts` | Editar servo com casa → campo **Casa** exibe o nome correto (não vazio). Editar servo de grupo → **Grupo** preenchido |
| `apps/adm.fonte/e2e/residents.spec.ts` | Editar filho com casa → campo **Casa** preenchido |
| `apps/adm.fonte/e2e/support-groups.spec.ts` | Editar grupo com coordenador → **Coordenador** preenchido |

Forçar a condição de corrida no teste: usar `page.route(...)` para atrasar a resposta de `GET /houses` (e `/staff`) e garantir que chega **depois** da entidade — assim o teste pega o bug real, não um happy-path mascarado.

Rodar: `pnpm test:adm` (requer `pnpm test:setup` + `pnpm dev:api:test` + adm na porta 5174). Todos verdes.

## Verificação manual

1. `pnpm dev:adm` — editar um servo com casa: campo **Casa** vem preenchido. Repetir com servo de grupo de apoio.
2. Editar um filho com casa: campo **Casa** preenchido.
3. Editar grupo de apoio com coordenador: campo **Coordenador** preenchido.
4. Throttle de rede (DevTools) para garantir que opções cheguem depois da entidade e o valor persista.
5. Auditar `ops.fonte`/`app.fonte`: abrir cada form com Picker de query async e confirmar seleção pré-preenchida em edição.
