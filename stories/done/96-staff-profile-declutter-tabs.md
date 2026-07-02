# Plan: Perfil de servo — remover campos de tratamento e cadastrar em abas

## Context

Bloco do BACKLOG "perfil dos servos": *"O perfil dos servos tem muita semelhança
com o perfil de filhos. quero remover esta impressão. Tudo que é campo referente
a tratamento, dependência, quero remover. No cadastro de servos, dá pra separar em
abas (sistema, pessoal, endereço e contato, etc). Só a primeira aba deve conter
campos obrigatórios no cadastro."*

A entidade `Staff` (`services/api/src/modules/staff/staff.entity.ts`) hoje espelha
a ficha do `Resident` — inclusive campos clínicos/de tratamento que **não fazem
sentido para um servo** e dão a impressão de "ficha de acolhido":
`addiction` (dependência), `health_issues`, `continuous_medication`, `weight`,
`height`. O form de cadastro (`features/staff/` no adm.fonte, schema em
`lib/staffSchema.ts`) é um formulário plano com todos os campos juntos.

Este é o **1/3** do bloco. As outras partes: story 97 (telefone→whatsapp e
whatsapp como login) e story 98 (aba de anexos do servo).

### Decisões travadas

- **Remover de vez (dropar colunas)**: migration nova remove de `staff` as colunas
  `addiction`, `health_issues`, `continuous_medication`, `weight`, `height`.
  Limpeza definitiva — não só esconder no form. **Nunca editar migration
  existente; criar nova.**
- **Manter** os campos pessoais legítimos (nome, cpf, rg, nacionalidade, data de
  nascimento, gênero, estado civil, filhos, ocupação, escolaridade, religião,
  endereço/cidade/estado, contato). Só sai o que é tratamento/saúde/medida
  corporal.
- **Form em abas** (adm.fonte). Sugestão de agrupamento:
  - **Sistema/Acesso** (1ª aba, **única com obrigatórios**): nome, papel (role),
    rank/serve em grupo, casa, credencial de acesso. (O campo de login fica
    coerente com a story 97 — whatsapp.)
  - **Pessoal**: cpf, rg, nacionalidade, nascimento, gênero, estado civil,
    filhos, ocupação, escolaridade, religião.
  - **Endereço e contato**: endereço, cidade, estado, telefone/whatsapp.
  - (Aba de **Anexos** entra na story 98.)
- **Só a 1ª aba tem campos obrigatórios.** As demais são 100% opcionais — salvar
  com só a 1ª aba preenchida deve funcionar. `zod` reflete isso (obrigatórios só
  nos campos da aba Sistema).
- Form continua `react-hook-form` + `zod` (nunca `useState` de campo). Abas não
  podem desmontar campos a ponto de perder valor digitado (manter no form state).

## Desenho

### Backend (`services/api/src/modules/staff/`)

- Migration nova `…-StaffRemoveTreatmentFields.ts`: `DROP COLUMN` de `addiction`,
  `health_issues`, `continuous_medication`, `weight`, `height` em `staff`.
- Entity `Staff`: remover os 5 campos.
- DTOs `create-staff.dto.ts` / `update-staff.dto.ts` / `update-staff-me.dto.ts`:
  remover os campos. Service e mapeamentos: remover referências.
- `@fonte/types`: limpar os campos do tipo Staff compartilhado, se expostos.
- Atualizar `fonte-api.postman_collection.json` (bodies de staff sem os campos).
- Verificar usos órfãos (telas que liam esses campos) e remover.

### adm.fonte (`features/staff/`)

- `lib/staffSchema.ts`: remover `addiction`, `healthIssues`,
  `continuousMedication`, `weight`, `height`. Tornar obrigatórios **apenas** os
  campos da aba Sistema; demais opcionais.
- Componentizar o form em abas: um componente de tabs + um componente por aba
  (`StaffSystemTab`, `StaffPersonalTab`, `StaffAddressContactTab`) — cada um
  < ~150 linhas, responsabilidade única. `NewStaffPage`/`EditStaffPage` orquestram
  as abas sem JSX de detalhe. Indicar visualmente qual aba tem erro de validação.
- Remover qualquer exibição dos campos clínicos no `StaffDetailPage`/
  `StaffOverviewTab`.

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem
`skip`/`only`/`xfail` injustificado. (`pnpm test:api` / `pnpm test:api:cov` +
`pnpm test:adm` + runner de cobertura do adm.)

- **Backend**: testes de staff service/controller atualizados — não referenciam
  mais os campos removidos; criar/atualizar staff sem eles funciona; suíte verde
  (regressão). E2E de criação/edição de staff segue passando.
- **adm.fonte**:
  - `staffSchema.test.ts`: obrigatórios só nos campos da aba Sistema; salvar com
    abas Pessoal/Endereço vazias é válido; campos removidos não existem no schema.
  - componentes de aba: render de cada aba, navegação entre abas preserva valores,
    aba com erro sinalizada.
  - E2E (`pnpm test:adm`): criar servo preenchendo só a 1ª aba; editar
    preenchendo abas opcionais; detalhe não mostra campos clínicos.
- **Contratos**: `pnpm build:types` / `pnpm build:api-client` verdes.

## Fora de escopo

- Telefone→whatsapp e whatsapp como login — **story 97**.
- Aba de anexos do servo — **story 98**.
- Migração/retrabalho da ficha do Resident (só Staff é tocado).
- Backfill/preservação dos dados clínicos removidos (decisão: dropar de vez).
