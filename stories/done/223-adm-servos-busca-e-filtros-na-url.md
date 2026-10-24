# Plan: busca e filtros de status e casa na lista de servos do `adm.fonte`

## Context

A tela *Servos* do `adm` (`features/staff/pages/StaffPage.tsx`) só tem o filtro **Ativos |
Desligados** (story 217), já guardado na URL (`?status=dismissed`). Não há busca nem filtro por
casa. Com servos de várias casas na mesma lista, o ADMIN rola a página inteira para achar alguém.
A tela de filhos já resolve isso: busca com debounce, filtros na URL e preferência salva
(stories 129/130).

Pedido do usuário (BACKLOG): na tela de servos do `adm`, adicionar campo de busca e filtros por
status e casa, tudo persistido na URL, igual à tela de filhos.

### Decisões travadas (usuário)

1. **Busca e filtro de casa no backend.** `GET /staff` ganha `search` e `houseId` no
   `ListStaffQueryDto`, no mesmo padrão de `GET /residents`. O cliente não filtra o array.
2. **A busca casa nome e CPF.** Nome sem acento e sem caixa (`unaccent(LOWER(...)) LIKE`). Termo
   com dígitos também casa `staff.cpf` pelos dígitos, igual a filhos.
3. **URL + preferência do usuário.** Os filtros vivem na URL e também são salvos como preferência
   (story 130), chave nova `staff.filters`. Ao abrir a tela sem nenhum filtro na URL, a
   preferência hidrata a URL. `q` (busca) não entra na preferência, igual a filhos.

### Decisões de desenho (defaults assumidos no refino)

4. **Status continua com os dois valores da story 217**, `active` (default, ausente na URL) e
   `dismissed`. Não há opção "Todos".
5. **Escopo por casa não muda (LGPD art. 6/46).** Para COORDINATOR, o `houseId` continua derivado
   do staff autenticado. O `houseId` da query é **ignorado** para não-ADMIN, e o filtro de casa
   nem aparece na tela para ele. Só o ADMIN escolhe casa.
6. **Filtro de casa inclui "Sem casa"?** Não. Servo de grupo de apoio sem `house_id` aparece só em
   "Todas as casas". Opção "Sem casa" fica fora de escopo.
7. **Sem paginação.** A lista segue array simples, ordenada por nome. Paginação é outra story se o
   volume pedir.
8. **Params da URL** iguais aos de filhos: `q`, `status`, `house`. A preferência guarda
   `{ status, house }`. A hidratação só roda quando a URL não traz nenhum filtro persistido, para
   o link compartilhado ser determinístico.
9. **A preferência é gravada só em mudança de filtro feita pelo usuário**, nunca na hidratação.

---

## Desenho

### Backend (`services/api/src/modules/staff`)

- `dto/list-staff-query.dto.ts`: + `search?: string` (`@IsOptional @IsString @MaxLength(100)`,
  trim) e `houseId?: string` (`@IsOptional @IsUUID`).
- `staff.service.ts` → `findAll(caller, { status, search, houseId })`: troca o `find` por query
  builder (relations `user`, `house`, `supportGroup` mantidas, `ORDER BY name`).
  - status: mesma regra atual (`ACTIVE_STAFF_WHERE` / `dismissed_at IS NOT NULL`);
  - search: nome via `unaccent(LOWER(staff.name)) LIKE unaccent(LOWER(:search))`; se tem dígitos,
    `OR staff.cpf LIKE :cpfSearch` com só os dígitos. Parâmetros bind, nada interpolado;
  - houseId: aplicado só para ADMIN. Não-ADMIN usa a casa do próprio staff (regra atual).
- `staff.controller.ts`: repassa o DTO inteiro ao service.
- `fonte-api.postman_collection.json`: `GET /staff` com os query params novos e a nota de que
  `houseId` é ignorado para COORDINATOR.

### Contratos (`packages/types`, `packages/api-client`)

- `types`: `StaffFiltersPreference { status: StaffListStatus; house: string }` e
  `STAFF_FILTERS_PREFERENCE_KEY = 'staff.filters'`. A preferência aceita key livre, então não
  precisa de migration.
- `api-client`: `staff.list({ status, search, houseId })` monta a query string sem params vazios.

### `adm.fonte` (`features/staff/`)

```
components/StaffFilters.tsx         ← novo; busca + StaffStatusFilter + seletor de casa (só ADMIN)
hooks/useStaff.ts                   ← useStaff({ status, search, houseId }) com queryKeys.staff.list(params)
hooks/useStaffFiltersUrl.ts         ← novo; lê/escreve q/status/house na URL, debounce, hidratação pela preferência
pages/StaffPage.tsx                 ← orquestra; título "Servos (N)"
lib/queryKeys.ts                    ← staff.list(params) inclui search e houseId
```

- Reaproveitar o que a tela de filhos já tem: `useDebounce`, `usePreference`, o seletor de casa
  usado em `ResidentsFilters` (extrair para `components/shared/` se hoje é local de residents) e a
  guarda por valor da sincronização `q` ↔ URL (ver o comentário do StrictMode em
  `ResidentsPage.tsx`).
- A lógica de URL + preferência vai num hook (`useStaffFiltersUrl`) para a page não passar de ~150
  linhas e para a lógica ser testável. Se der para generalizar sem malabarismo, um hook comum para
  filhos e servos é bem-vindo, mas não é obrigatório.
- Estado vazio diferencia "Nenhum servo encontrado." (com busca/casa) dos textos atuais.

---

## Validação

### Backend: unit (`pnpm test:api`, `staff.service.spec.ts` / `staff.controller.spec.ts`)

- `search` por nome com acento/caixa diferente casa; termo com dígitos casa CPF; termo sem match
  → vazio.
- ADMIN com `houseId` → só servos da casa; sem `houseId` → todos.
- COORDINATOR com `houseId` de **outra** casa → continua vendo só a própria (param ignorado).
- SERVANT/sem casa → `[]` (regressão).
- `status=dismissed` combinado com `search`/`houseId`.
- DTO: `houseId` não-UUID → 400; `search` > 100 chars → 400.
- Controller repassa o DTO completo.

### Backend: e2e (`pnpm test:api:e2e`)

- `GET /staff?search=<parte do nome>` e `?houseId=` como ADMIN → filtra; como COORDINATOR com
  `houseId` alheio → só a própria casa. Fixtures próprias criadas e removidas por id (story 182).

### Contratos

- `pnpm build:types` e `pnpm build:api-client`; `pnpm test:api-client` cobre a query string
  (params vazios omitidos).

### `adm.fonte`: unit (`pnpm test:adm:unit`)

- **`useStaffFiltersUrl`**: lê `q`/`status`/`house` da URL; mudança grava na URL com
  `replace`; busca com debounce; URL vazia + preferência → hidrata; URL com qualquer filtro →
  ignora a preferência; mudança do usuário persiste `{ status, house }` sem `q`; a hidratação não
  grava a preferência.
- **`StaffFilters`**: seletor de casa visível só para ADMIN; callbacks disparam.
- **`StaffPage`**: passa os filtros ao `useStaff`; estados loading/erro/vazio; título com a
  contagem.
- Atualizar `StaffPage.test.tsx` e `useStaff.test.tsx` existentes.

### `adm.fonte`: E2E (`pnpm test:adm`)

- Spec de servos: buscar pelo nome → lista filtra e a URL ganha `q`; escolher casa → URL ganha
  `house`; recarregar a página → filtros mantidos; voltar do detalhe → filtros mantidos; sair e
  voltar sem params → preferência restaura status/casa. Fixtures por id, seed só leitura, e limpar
  a preferência `staff.filters` do usuário de teste no `afterAll`.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente. Código novo sem teste não fecha a story.
Rodar `pnpm test:api:cov` e a cobertura de `pnpm test:adm:unit`, **sem reduzir** a cobertura de
`modules/staff` e `features/staff`. Código novo ≥90%. Sem `skip`/`only`/`xfail` sem justificativa
no código (CLAUDE.md).

---

## Fora de escopo

- Paginação/infinite scroll da lista de servos (decisão 7).
- Opção "Todos" no status e "Sem casa" no filtro de casa (decisões 4 e 6).
- Ordenação configurável.
- Busca por e-mail, WhatsApp ou ministério.
- Busca/filtros na lista de servos do `ops` (story 204).
