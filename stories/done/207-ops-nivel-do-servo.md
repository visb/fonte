# Plan: mostrar o nível do servo no `ops.fonte`

## Context

O servo tem um nível espiritual (`Staff.rank`: `ASPIRANTE` → `CONSAGRADO` → `ALIANCADO`; `null` para
coordenador/admin). O `adm` já mostra esse nível como badge colorido
(`apps/adm.fonte/src/features/staff/constants.ts`), mas o `ops` não mostra em lugar nenhum. Pedido:
*"no app ops, em todos os lugares que mostrar servos, mostrar também o nível do servo"*.

### Decisões travadas (usuário)

1. **Escopo: listas e identidade, sem autoria.** O badge entra onde o servo aparece *como pessoa*:
   - a tela **Servos** (story 204), em `StaffListItem`;
   - o **`LeaderPickerModal`** dos ministérios;
   - o **líder do ministério**, em `MinistryCard` e `MinistryOverviewTab`;
   - o **perfil do usuário logado**: `MenuProfileCard`, `ProfilePage` e `WelcomeHeader` do dashboard.

   Ficam **fora** os nomes que aparecem só como autoria/responsável: ocorrências
   (`IncidentFormFields`), almoxarifado/despensa (`ResponsibleDisplay`), comentários de atividades,
   `TrackingEventItem` (`createdByName`), venda de rua.
2. **Badge colorido, mesmo padrão do `adm`**: Aspirante cinza, Consagrado azul, Aliançado verde.
   Sem nível (`rank` nulo: coordenador, admin ou servo ainda sem nível) → sem badge, nada de
   "Sem nível".

### Decisões de desenho (defaults assumidos)

3. **Rótulos e cores num lugar só no `ops`**: `features/staff/constants.ts` com
   `SERVANT_RANK_LABELS` e as classes de cor, e um componente `ServantRankBadge({ rank })` em
   `components/shared/` (usado por staff, ministries, menu, profile e dashboard), que devolve `null`
   quando `rank` é nulo. Os rótulos repetem os do `adm`. Mover para `@fonte/types` fica fora desta
   story (cada app tem seu sistema de badge).
4. **Dados:**
   - `GET /staff/me` já devolve a entidade com `rank`, e o tipo `Staff` do api-client já o tem.
     Perfil, menu e dashboard **não precisam de backend**.
   - `GET /houses/:id/staff` (`HouseService.findStaffForHouse`, estendido pela 204) passa a devolver
     também `rank`. Alimenta a tela Servos e o `LeaderPickerModal`.
   - Ministérios (`MinistryService`, listagem e detalhe): devolvem `leaderRank` junto de
     `leaderName` (`CASE WHEN m.leader_type = 'STAFF' THEN s.rank ELSE NULL END`). Líder `RESIDENT`
     → `null`. Mudança aditiva.
5. **Offline:** as três leituras já são cache persistido (staff da casa pela 204, ministérios e
   `staff.me`). O campo novo vem junto, sem key nova na allowlist. Placeholder otimista de mutation
   que monte líder/servo deve preencher `rank: null`/`leaderRank: null` em vez de deixar o campo
   indefinido.

### Dependências

- **Story 204** (tela Servos no `ops`) cria `StaffListItem`, `features/staff/` e estende
  `findStaffForHouse`. **Esta story vem depois da 204.** Se a 204 ainda não estiver na main, a
  implementação desta faz só as partes que não dependem dela e registra o bloqueio. Nada de criar
  tela paralela.

---

## Desenho

### 1. Backend (`services/api`)

- `HouseService.findStaffForHouse`: `s.rank` no `SELECT` (e no `GROUP BY` da 204).
- `MinistryService`: `leaderRank` nas queries de listagem e detalhe, ao lado de `leaderName`.
- Sem migration. **Postman**: respostas de `GET /houses/:id/staff`, `GET /ministries` e
  `GET /ministries/:id` com os campos novos.

### 2. Contratos

- `@fonte/api-client`: `rank: ServantRank | null` no item de `houses.listStaff`;
  `leaderRank: ServantRank | null` nos tipos de ministério (lista e detalhe).
- `pnpm build:types` / `pnpm build:api-client`.

### 3. `ops.fonte`

```
components/shared/ServantRankBadge.tsx  ← badge colorido; null sem rank
features/staff/constants.ts             ← SERVANT_RANK_LABELS + cores
```

- `features/staff/components/StaffListItem.tsx` (204): badge ao lado do badge de papel.
- `features/ministries/components/LeaderPickerModal.tsx`: badge em cada servo.
- `features/ministries/components/MinistryCard.tsx` e `MinistryOverviewTab.tsx`: badge ao lado do
  nome do líder.
- `features/menu/components/MenuProfileCard.tsx`, `features/profile/pages/ProfilePage.tsx` (ou
  componente de cabeçalho dela), `features/dashboard/.../WelcomeHeader`: badge com
  `staff?.rank`. No modo Resident não aparece.
- Placeholders offline (`lib/offline/mutationDefaults.ts` etc.) que montam ministério ou líder
  preenchem o campo novo com `null`.

---

## Validação

### Backend: `pnpm test:api`

- `findStaffForHouse` devolve `rank` do servo e `null` para coordenador.
- Ministério com líder `STAFF` devolve `leaderRank` do servo; com líder `RESIDENT` ou sem líder,
  `leaderRank: null`. Cobrir listagem e detalhe (`ministry.service.spec.ts`).

### Backend: `pnpm test:api:e2e`

- `GET /houses/:id/staff` e `GET /ministries/:id` como `SERVANT` → 200 com `rank`/`leaderRank`.
  Fixture própria via API (servo com rank + ministério liderado), removida no `afterAll`, com limpeza
  por id (story 182).

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- **`ServantRankBadge`**: um caso por nível (rótulo e cor certos); `rank` nulo → nada renderizado.
- **`StaffListItem`**: servo com nível mostra o badge; coordenador não.
- **`LeaderPickerModal`**: servos listados com o badge do nível.
- **`MinistryCard` / `MinistryOverviewTab`**: líder servo com badge; líder interno ou sem líder,
  sem badge.
- **`MenuProfileCard` / `ProfilePage` / `WelcomeHeader`**: staff com nível mostra o badge; sem
  nível ou em modo Resident, não.
- **Offline**: placeholder otimista de ministério tem `leaderRank: null` (atualizar o teste de
  `mutationDefaults` existente se tocado).

### `ops.fonte`: Maestro (`pnpm test:ops`)

- No fluxo da tela Servos (204), assertar o rótulo do nível do servo do seed. O seed precisa ter
  servo com `rank` definido; se não tiver, ajustar `seed-test.ts`.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` sem reduzir a cobertura de `house` e
`ministry`. `pnpm test:ops:unit` com cobertura: `ServantRankBadge` e os componentes tocados ≥90%.
Sem `skip`/`only`/`xfail` sem justificativa explícita no código (CLAUDE.md).

---

## Fora de escopo

- **Nível em autoria/responsável** (ocorrências, almoxarifado, despensa, comentários,
  acompanhamentos, venda de rua). Decisão 1.
- **Editar o nível pelo `ops`**: continua no `adm`.
- **`app.fonte`** e **`portal.fonte`**.
- Mover rótulos de nível para `@fonte/types` / unificar com o `adm`.
- Filtro ou ordenação por nível na tela Servos.
