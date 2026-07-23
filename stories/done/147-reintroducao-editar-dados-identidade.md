# Plan: Reintrodução — editar os "dados não editáveis" (correção de identidade)

## Context

Bloco **App adm → Reintrodução de acolhido** do BACKLOG. Mesmo fluxo/tela das stories 146 e 148
(`ReadmissionForm`).

Hoje o banner "Dados de identificação — não editáveis" (nome, CPF, RG, nascimento, gênero) é
read-only. Se no acolhimento anterior algum desses campos foi cadastrado errado, não há como
corrigir na reintrodução. O item pede uma opção para **editar** esses dados.

Decisões travadas com o usuário:

- **UX:** botão "Editar" no próprio banner da reintrodução → abre edição (modal ou inline) dos 5
  campos de identidade, antes de concluir a reintrodução. Contido no fluxo de reintrodução.
- **Permissão:** **somente ADMIN** pode editar identidade (dado sensível). COORDINATOR/SERVANT não
  veem/usam o botão.

Levantamento do planning:

- Backend já sabe atualizar esses campos: `UpdateResidentDto`
  (`services/api/src/modules/resident/dto/update-resident.dto.ts`) já tem `name`, `cpf`, `rg`,
  `birthDate`, `gender`. Mas `PATCH /residents/:id` (`resident.controller.ts:288`) é
  `@Roles(ADMIN, COORDINATOR)` e mistura todos os campos do resident — não serve para um gate
  ADMIN-only apenas nos campos de identidade.
- `GET /residents/:id` é `@RevealSensitive()`: ADMIN recebe CPF/RG **completos** (necessário para
  editar com o valor real). Ver [[146-reintroducao-cpf-completo]] (double-mask); a edição deve
  prefixar o form com o valor completo que o ADMIN recebe, sem reaplicar formatador cegamente.

Decisão de desenho travada: expor um **endpoint dedicado** `PATCH /residents/:id/identity`
`@Roles(ADMIN)` para os 5 campos de identidade, com `@RevealSensitive()` + `@Audit`, em vez de
afrouxar a rota `PATCH :id` compartilhada. Enforcement de permissão fica no backend (não só na UI).

## Desenho

**Backend (`services/api/src/modules/resident`):**

1. `UpdateResidentIdentityDto` com `name?`, `cpf?`, `rg?`, `birthDate?`, `gender?` (validações
   `class-validator` equivalentes às já usadas em `UpdateResidentDto`; CPF/RG opcionais e anuláveis).
2. Rota `PATCH /residents/:id/identity` `@Roles(Role.ADMIN)` `@RevealSensitive()`
   `@Audit('resident.identity.update', 'resident')` → `residentService.updateIdentity(id, dto)`.
3. `updateIdentity` no service atualiza só os campos de identidade e retorna o resident (findOne).
4. Atualizar `fonte-api.postman_collection.json` com a nova rota.

**Frontend (`apps/adm.fonte`):**

5. `useUpdateResidentIdentity(id)` (mutation) no `hooks/useResidents.ts`, invalidando
   `queryKeys.residents.detail(id)` + listagens relevantes.
6. Método no `@fonte/api-client` para o novo endpoint (não duplicar em cada app).
7. No banner de `ReadmissionForm`, botão "Editar" visível **só para ADMIN** (checar role via o
   mecanismo de auth já existente no adm). Abre `EditResidentIdentityDialog` autossuficiente
   (react-hook-form + zod), pré-preenchido com os valores atuais (completos, pois ADMIN os recebe),
   com máscaras de input de CPF/RG já existentes (`withMask`, `maskCPF`, `maskRG`).
8. Ao salvar, refetch do resident → banner reflete a correção antes de concluir a reintrodução.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Gate: **código novo sem teste
não fecha a story** — `pnpm test:api:cov` + `pnpm --filter adm.fonte test:cov` verdes, cobertura
≥90 do código tocado; `pnpm build:types`/`build:api-client` se os contratos mudarem.

- **API unit** (`resident.service.spec.ts`): `updateIdentity` altera só os 5 campos e retorna o
  resident atualizado.
- **API e2e / controller** (`resident.controller.spec.ts` / e2e): `PATCH :id/identity` retorna 200
  para ADMIN; **403 para COORDINATOR e SERVANT** (gate de permissão); resposta revela CPF/RG
  completos para ADMIN.
- **adm unit**: botão "Editar" renderiza só para ADMIN e não para COORDINATOR/SERVANT;
  `EditResidentIdentityDialog` valida (nome obrigatório) e dispara a mutation com o payload correto.

## Fora de escopo

- Exibição correta do CPF (double-mask) — story 146.
- Status inicial da reintrodução — story 148.
- Editar identidade fora do fluxo de reintrodução (ex: na ResidentDetailPage) — não pedido.
- Histórico/auditoria além do `@Audit` já aplicado.
