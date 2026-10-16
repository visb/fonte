# Plan: `DateInput` próprio no `adm.fonte` — ícone de calendário e calendário pt-BR no foco

## Context

Os campos de data do `adm.fonte` usam o `<input type="date">` nativo do navegador. São cerca de 20
campos em 18 arquivos: nascimento, entrada, saída, pagamento, vencimento, follow-up, curso bíblico,
filtros de contas a pagar, entre outros. O visual e o comportamento do nativo variam por navegador,
e ele não segue o resto da interface (shadcn).

Pedido do usuário: **um input personalizado, com ícone de calendário, que abre um calendário ao
receber foco.**

Esta story também é base para as próximas do backlog (maior de 18 anos no nascimento, entrada sem
data futura, saída depois da entrada). Elas precisam bloquear datas no calendário, então o
componente nasce com `min`/`max`.

### Decisões travadas (usuário)

1. **Input próprio com ícone de calendário; o foco abre o calendário.** Clicar no ícone também abre.
2. **Só data pura.** Os campos `datetime-local` de eventos (`EventForm`,
   `EventRegistrationSection`) ficam fora.

### Decisões de desenho (defaults assumidos no refino)

3. **Digitar continua possível.** O campo aceita `dd/mm/aaaa` com máscara, além do clique no
   calendário. Digitar a data de nascimento é bem mais rápido que navegar décadas no calendário, e
   quem lança em lote (pagamentos) digita.
4. **O valor do formulário não muda: string `YYYY-MM-DD`**, o mesmo do input nativo. Os schemas zod,
   os DTOs, o `@fonte/api-client` e o backend não são tocados. A exibição é `dd/mm/aaaa`; a
   conversão fica só dentro do componente.
5. **Calendário com seletor de mês e de ano** (dropdowns no cabeçalho). Sem isso, chegar a um
   nascimento de 1975 exige centenas de cliques.
6. **Biblioteca: `react-day-picker` + `date-fns` (locale `ptBR`)**, no padrão do Calendar do shadcn,
   dentro do `Popover` que o app já tem (`@/components/ui/popover`). Semana começa no domingo, nomes
   em português.
7. **Integração com `react-hook-form`.** Como `register` depende de um `<input>` nativo com
   `onChange` de evento, cada campo migra para `Controller`, via um wrapper `ControlledDateInput`
   para não repetir o `Controller` 20 vezes. Os filtros sem form (`PayablesFilters`) usam o
   `DateInput` com `value`/`onChange` direto.
8. **`min`/`max` em `YYYY-MM-DD`**: datas fora do intervalo ficam desabilitadas no calendário, e a
   digitação fora do intervalo cai no erro de validação do schema (não é corrigida em silêncio). O
   `max={TODAY}` do `PromoteToServantDialog` é preservado.
9. **Acessível por teclado**: o foco abre o popover sem roubar o foco do input; `Esc` fecha; `Tab`
   sai do campo e fecha; setas navegam no calendário quando ele recebe foco. Escolher um dia fecha
   o popover e devolve o foco ao input.

---

## Desenho

### 1. Componentes (`apps/adm.fonte/src/components/`)

- **`ui/calendar.tsx`**: Calendar do shadcn (react-day-picker), com `locale={ptBR}` e
  `captionLayout="dropdown"`.
- **`shared/DateInput.tsx`**:
  ```ts
  interface DateInputProps {
    value: string;                 // 'YYYY-MM-DD' ou ''
    onChange: (value: string) => void;
    onBlur?: () => void;
    min?: string;
    max?: string;
    id?: string;
    disabled?: boolean;
    placeholder?: string;          // default 'dd/mm/aaaa'
    'aria-invalid'?: boolean;
  }
  ```
  Input com máscara + ícone `CalendarDays` (lucide) à direita, dentro de `Popover`. Foco ou clique
  no ícone abre; selecionar um dia chama `onChange(iso)` e fecha. Texto incompleto ou inválido não
  chama `onChange` com lixo: mantém o texto e emite `''`, para o zod acusar.
  Mês inicial do calendário: o do valor, senão o do `max` (se for passado), senão o mês atual.
- **`shared/ControlledDateInput.tsx`**: `Controller` + `DateInput`, com `control`, `name`,
  `min`, `max`.

Se algum dos dois passar de ~150 linhas (regra do CLAUDE.md), extrair a máscara/parse para
`lib/dateMask.ts`.

### 2. Migração dos campos

Todos os `<Input type="date">` de `apps/adm.fonte/src` passam a usar `ControlledDateInput` (ou
`DateInput` nos filtros). Lista atual do levantamento:

`PersonalDataFields` (nascimento), `StaffPersonalTab` (nascimento),
`EditResidentIdentityDialog` (nascimento), `ResidentFormSections` (entrada, saída),
`ReadmissionForm` (entrada), `RemoveResidentDialog` (saída), `PromoteToServantDialog` (data, `max`),
`AddFollowUpDialog`, `RegisterPaymentDialog`, `PayableForm`, `PayPayableDialog`,
`PayablesFilters` (2), `BibleClassDialog` (início/fim, mantendo o `handleStartChange`), e os campos
de data de `FilhosPage` e `StreetSalesPageContent`.

A implementação refaz o grep (`type="date"`) antes de começar; o que aparecer a mais entra.
Depois da migração, o grep não pode encontrar nenhum `type="date"` em `apps/adm.fonte/src`.

### 3. Dependências

`pnpm --filter adm.fonte add react-day-picker date-fns`. Sem mudança em `packages/*`, backend ou
Postman.

---

## Validação

### `adm.fonte`: unit (Vitest/RTL, `pnpm test:adm:unit`)

- **`DateInput`**:
  - mostra `value` `2026-03-07` como `07/03/2026`;
  - focar abre o calendário em pt-BR (nome do mês em português);
  - clicar no ícone abre;
  - escolher um dia chama `onChange('YYYY-MM-DD')` e fecha;
  - digitar `07032026` com a máscara emite `2026-03-07`;
  - digitação incompleta ou inválida (`31/02/2026`) emite `''`;
  - dias fora de `min`/`max` desabilitados no calendário;
  - `Esc` fecha e `Tab` sai;
  - seletor de ano presente;
  - mês inicial segue a regra valor → `max` → atual.
- **`ControlledDateInput`**: integra com `useForm` (valor inicial, submit com `YYYY-MM-DD`, erro do
  zod exibido).
- **Specs existentes dos formulários migrados** (`ResidentFormSections`, `RemoveResidentDialog`,
  `PromoteToServantDialog`, `RegisterPaymentDialog`, `AddFollowUpDialog`, `ReadmissionForm`,
  `EditResidentIdentityDialog` etc.): passam a preencher a data pelo componente novo, e o valor
  enviado no submit continua idêntico ao de antes. Mudar a forma de preencher no teste é esperado;
  mudar o payload esperado não.
- **Catraca**: teste que varre `apps/adm.fonte/src` e falha se aparecer `type="date"` fora de
  testes, para ninguém reintroduzir o nativo.

### `adm.fonte`: e2e (Playwright, `pnpm test:adm`)

Os specs que preenchem data com `fill('YYYY-MM-DD')` em input nativo passam a digitar
`dd/mm/aaaa` no campo novo (ou escolher no calendário). Ajustar um helper em `e2e/helpers/` em vez
de cada spec. Um caso novo, no acolhimento: abrir o calendário pelo foco, trocar ano e mês nos
dropdowns, escolher o dia, salvar e ver a data certa na ficha.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:adm:unit` com cobertura: `DateInput`,
`ControlledDateInput` e o parse/máscara com ≥90%, sem reduzir a cobertura das features migradas.
Sem `skip`/`only`/`xfail` sem justificativa explícita no código. Backend intocado.

---

## Fora de escopo

- **Data e hora** (`datetime-local` de eventos): fica para outra story.
- **`portal.fonte`, `ops.fonte`, `app.fonte`**: o `ops` já tem o `DatePickerModal` próprio.
- **Regras de validação de negócio** (18+, entrada sem data futura, saída depois da entrada):
  cada uma tem story própria, que usa o `min`/`max` daqui.
- **Seleção de intervalo** (range picker) nos filtros: continuam dois campos.
