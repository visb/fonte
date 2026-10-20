# Plan: administrador lotado na casa conta como coordenador dela

## Context

Pedido do backlog: *"permitir que administradores sejam coordenadores de casas"*.

Hoje (story 194) os coordenadores de uma casa são **derivados** de `Staff`: `staff.house_id = casa`
\+ `users.role = COORDINATOR` + não soft-deletado (`HouseService.findCoordinators`). O titular
(`houses.coordinator_id`) só pode ser eleito entre eles (`assertEligibleTitular`). Um `ADMIN` lotado
na casa fica **fora da lista**, não pode ser titular e, no `ops.fonte`, não enxerga os fluxos de
coordenador (Contagem, configurações da casa, pedido de capacidade), que são gated por
`role === COORDINATOR`. Na prática há casas cujo responsável é um administrador.

### Decisões travadas (usuário)

1. **Só a casa onde o admin está lotado.** ADMIN com `house_id = X` passa a ser coordenador de X.
   Sem tabela de junção, sem coordenar N casas: a regra derivada vira
   `role IN (COORDINATOR, ADMIN)`. Admin sem `house_id` não coordena casa nenhuma.
2. **Ganha também os fluxos de COORDINATOR no `ops`.** Além de aparecer na lista e poder ser
   titular, o admin lotado na casa abre no `ops` tudo que hoje é exclusivo do coordenador da casa.

### Decisões de desenho (defaults assumidos)

3. **Um predicado só, "coordenador da casa".** Criar no backend um helper
   (`isHouseCoordinatorRole(role)` → `COORDINATOR | ADMIN`, ex. em `common/auth/`) e usá-lo em
   todos os pontos abaixo, em vez de espalhar `role === COORDINATOR || role === ADMIN`. Espelho no
   `ops` em `lib/` (ou `features/menu`), usado por `useMenuAccess`, `HouseSettingsPage` e afins.
4. **Rotas `@Roles(Role.COORDINATOR)` puras passam a `@Roles(Role.COORDINATOR, Role.ADMIN)`**, com
   a checagem de vínculo com a casa já existente no service (ex.
   `HouseCapacityRequestService`: `staff.houseId === houseId || house.coordinatorId === staff.id`).
   Rotas conhecidas: `house-capacity-request.controller.ts:28`, `census.controller.ts:30` e `:40`.
   Implementação varre `@Roles(Role.COORDINATOR)` e `role === Role.COORDINATOR` para não esquecer
   nenhuma.
5. **Admin continua admin.** Nada de restringir o ADMIN pelas regras de coordenador: onde o ADMIN já
   tinha poder pleno (ex. `house.controller.ts:88`, que tira campos de capacidade só do
   COORDINATOR), o comportamento do ADMIN **não muda**. A mudança é só *aditiva*.
6. **Perder o titular.** `StaffService.update` hoje limpa o titular quando o staff sai da casa ou
   deixa de ser COORDINATOR (`leavesCoordinatorRole`). Passa a limpar quando deixa de ser
   coordenador-da-casa (role fora de `COORDINATOR | ADMIN`). Trocar COORDINATOR → ADMIN (ou o
   inverso) **mantém** o titular.
7. **`rank` continua nulo** para ADMIN (nada muda na hierarquia de servo).

### Dependências

Nenhuma. Toca o desenho da story 194 (coordenadores derivados) — manter os comentários/decisões dela
coerentes com a nova regra.

---

## Desenho

### 1. Backend (`services/api`)

- Helper `isHouseCoordinatorRole` + constante `HOUSE_COORDINATOR_ROLES = [COORDINATOR, ADMIN]`.
- `HouseService.findCoordinators`: `u.role = ANY($2)` com `HOUSE_COORDINATOR_ROLES`.
- `HouseService.assertEligibleTitular`: aceita role em `HOUSE_COORDINATOR_ROLES`.
- `StaffService.update`: `leavesCoordinatorRole` usa o helper (decisão 6).
- Rotas COORDINATOR-only (decisão 4): adicionar `Role.ADMIN`; o service segue exigindo vínculo com a
  casa quando já exigia.
- Sem migration.
- **Postman**: atualizar a descrição das rotas tocadas (roles aceitas) e o exemplo de
  `GET /houses/:id` (`coordinators` pode trazer ADMIN).
- `BUSINESS_RULES.md`: registrar que coordenador da casa = COORDINATOR **ou** ADMIN lotado nela.

### 2. `adm.fonte`

- Seletor de titular da casa lê `coordinators` do `GET /houses/:id` — passa a listar o admin lotado
  sem mudança de código. Conferir se há filtro client-side por `role === COORDINATOR` e removê-lo.
- Badge/rótulo do coordenador listado: mostrar o papel real (Administrador) se a UI exibir papel.

### 3. `ops.fonte`

- `features/menu/hooks/useMenuAccess.ts`: `isCoordinator` usa o helper (ADMIN entra); o gate
  `isHouseCoordinator` (vínculo com a casa) continua igual. `useHouseById` passa a disparar para
  ADMIN também.
- `features/house-settings/pages/HouseSettingsPage.tsx:24`: mesmo helper.
- Conferir `CensusPage` e demais gates de coordenador; `canRemove` já aceita ADMIN.
- Offline: nenhuma leitura nova — `houses.byId` já é persistida.

---

## Validação

### Backend: `pnpm test:api`

- `findCoordinators` passa `[COORDINATOR, ADMIN]` e devolve admin lotado na casa.
- `assertEligibleTitular`: ADMIN lotado na casa → ok; ADMIN de outra casa → 400; SERVANT → 400;
  desligado → 400.
- `StaffService.update`: COORDINATOR → ADMIN mantém titular; ADMIN → SERVANT limpa; ADMIN muda de
  casa limpa.
- Pedido de capacidade e contagem: ADMIN lotado na casa → permitido; ADMIN de outra casa segue a
  mesma regra de vínculo do coordenador.
- `house.controller.update`: ADMIN mantém poder de alterar capacidade (regressão da decisão 5).

### Backend: `pnpm test:api:e2e`

- `PATCH /houses/:id` com `coordinatorId` = admin lotado → 200; `GET /houses/:id` lista o admin em
  `coordinators`.
- `POST` de pedido de capacidade / rota de contagem como ADMIN lotado → 2xx (antes 403).
- Fixtures próprias via API (casa + admin), removidas no `afterAll`, limpeza por id (story 182).

### `adm.fonte`: `pnpm test:adm:unit` + Playwright (`pnpm test:adm`)

- Seletor de titular mostra o admin lotado quando ele vem em `coordinators`.
- E2E da edição da casa: eleger admin como titular (fixture própria).

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- `useMenuAccess`: ADMIN lotado na casa → `isHouseCoordinator` true e itens de coordenador no menu;
  ADMIN sem casa → false.
- `HouseSettingsPage`: ADMIN lotado na casa pode editar.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` sem reduzir a cobertura de `house`,
`staff` e `resident` (census); helper novo ≥90%. Runners com cobertura de `adm.fonte` e `ops.fonte`
para os arquivos tocados ≥90%. Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- Admin coordenando várias casas / tabela de junção (decisão 1).
- Mudar permissões gerais do ADMIN fora dos fluxos de coordenador.
- Mudar quem pode eleger o titular.
- `app.fonte` e `portal.fonte`.
