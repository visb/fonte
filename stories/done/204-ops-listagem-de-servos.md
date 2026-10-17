# Plan: listagem dos servos da casa no `ops.fonte`

## Context

No `ops.fonte` não há tela de servos. O operador vê os filhos da casa, mas não tem onde ver quem
são os servos da casa nem como falar com eles. Hoje isso fica na memória de cada um ou no
WhatsApp pessoal. Pedido do backlog: *"no app ops, tem que ter a listagem dos servos da casa"*.

O dado já existe: `GET /houses/:id/staff` (`HouseService.findStaffForHouse`) é aberto para
`ADMIN`, `COORDINATOR` e `SERVANT` e devolve `id`, `name`, `whatsapp` e `photoUrl` dos servos não
excluídos da casa. O `ops` já o consome no `LeaderPickerModal` dos ministérios
(`useHouseStaffForMinistry`, `queryKeys.ministries.houseStaff`). Falta a tela.

### Decisões travadas (usuário)

1. **Lista + contato, somente leitura.** Cada linha mostra foto, nome, papel (Coordenador/Servo)
   e os ministérios que a pessoa lidera. O botão de WhatsApp abre a conversa. Sem tela de detalhe,
   sem edição: cadastro de servo continua no `adm`.
2. **Todo o staff da casa vê**: coordenador e servo, com o mesmo gate de *Filhos*
   (`canAccessMenuItem` → default `isHouseStaff`). Servo de grupo de apoio e interno não veem.
3. **Funciona offline.** A lista entra na allowlist de persistência (invariante do `ops`). O
   WhatsApp do servo é contato interno da casa, já exposto a esses mesmos papéis pelo endpoint
   atual.

### Decisões de desenho (defaults assumidos no refino)

4. **O endpoint existente é estendido, não duplicado.** `findStaffForHouse` passa a devolver
   também `role` (do `User` ligado ao staff) e `ledMinistries: { id, name }[]` (ministérios com
   `leader_type = 'STAFF'` e `leader_id = staff.id`, não excluídos). A mudança é aditiva: os
   consumidores atuais (`LeaderPickerModal` no `ops`, dialogs de ministério no `adm`) ignoram os
   campos novos.
5. **Uma query key só para servos da casa**: `queryKeys.staff.byHouse(houseId)`. O
   `useHouseStaffForMinistry` passa a usá-la (vira `useHouseStaff` em `features/staff/hooks/`),
   para a lista e o seletor de líder compartilharem cache, inclusive offline. A key antiga
   `house-staff-for-ministry` sai. É só cache de leitura (nada na fila de mutations), então trocar
   não perde lançamento.
6. **Pré-carregada no aquecimento da casa** (`warmHouseCache` / `prefetch.ts`), como as outras
   leituras de campo, para estar disponível no primeiro uso sem sinal.
7. **WhatsApp**: abre `https://wa.me/<número normalizado com 55>` via `Linking`. Sem número, sem
   botão. O próprio usuário logado aparece na lista, marcado "(você)", sem botão de WhatsApp.
8. **Ordem**: coordenadores primeiro, depois servos, por nome dentro de cada grupo. Busca por nome
   só se a casa passar de ~15 servos; abaixo disso a lista basta (default: sem busca nesta story).
9. **Item no menu** "Servos", ícone `id-card-outline` (`people-outline` já é de *Filhos*), seção
   *Casa*, logo depois de *Filhos*. Sem ação rápida no dashboard.

### Dependências

- **Story 205** (filtro de casa nos ministérios) mexe no mesmo hook de servos da casa. Se for
  implementada antes, esta reaproveita; se depois, rebaseia sobre a key nova. Não bloqueia.

---

## Desenho

### 1. Backend (`services/api`)

`HouseService.findStaffForHouse`:

```sql
SELECT s.id, s.name, s.whatsapp, s.photo_url AS "photoUrl", u.role,
       COALESCE(json_agg(json_build_object('id', m.id, 'name', m.name) ORDER BY m.name)
                FILTER (WHERE m.id IS NOT NULL), '[]') AS "ledMinistries"
FROM staff s
JOIN users u ON u.id = s.user_id
LEFT JOIN ministries m ON m.leader_type = 'STAFF' AND m.leader_id = s.id AND m.deleted_at IS NULL
WHERE s.house_id = $1 AND s.deleted_at IS NULL
GROUP BY s.id, u.role
ORDER BY s.name
```

(Ajustar nomes reais de tabela/coluna ao schema e conferir se `ministries` tem `deleted_at`.)
Acesso a banco fica no service/repository, como já está. Sem migration.

**Postman**: a resposta de `GET /houses/:id/staff` com os campos novos.

### 2. Contratos

- `@fonte/api-client`: o tipo de retorno de `houses.listStaff` ganha `role: Role` e
  `ledMinistries: { id: string; name: string }[]`. `pnpm build:types` / `pnpm build:api-client`.

### 3. `ops.fonte`

```
features/staff/
  hooks/useHouseStaff.ts        ← useQuery(queryKeys.staff.byHouse(houseId))
  components/StaffListItem.tsx  ← foto/iniciais, nome, badge de papel, ministérios, botão WhatsApp
  pages/StaffPage.tsx           ← orquestra; LoadingState/EmptyState/ErrorState do app
  constants.ts                  ← rótulos de papel
app/(app)/staff/_layout.tsx + index.tsx
```

- `lib/queryKeys.ts`: `staff.byHouse`; remover `ministries.houseStaff`.
- `lib/offline/constants.ts`: `staff.byHouse` na allowlist de persistência.
- `lib/offline/prefetch.ts`: prefetch da lista no aquecimento da casa.
- `features/menu/constants.ts`: chave `staff` em `MENU_ITEM_KEYS` e `MENU_ITEMS`; o gate cai no
  default `isHouseStaff`.
- `features/ministries/`: `LeaderPickerModal` (e quem mais usar `useHouseStaffForMinistry`)
  passa a importar `useHouseStaff`.
- `houseId` do `useAuth().staff`. Sem casa (servo de grupo de apoio): a rota não aparece no menu,
  e a página trata `houseId` nulo sem query.

---

## Validação

### Backend: `pnpm test:api`

- `findStaffForHouse` devolve `role` correto para coordenador e servo e `ledMinistries` com os
  ministérios liderados.
- Ministério excluído, ou com líder `RESIDENT`, não aparece.
- Servo sem ministério → `[]`.
- Servo excluído não aparece.
- Servo de outra casa não aparece.

### Backend: `pnpm test:api:e2e`

`GET /houses/:id/staff` como `SERVANT` → 200 com os campos novos; como `RELATIVE` → 403. Fixtures
próprias via API (servo + ministério liderado), removidas no `afterAll`, limpeza por id
(story 182).

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- **`StaffListItem`**:
  - mostra nome, papel e ministérios;
  - com WhatsApp, o botão chama `Linking.openURL` com `https://wa.me/55…` normalizado;
  - sem WhatsApp, não há botão;
  - o usuário logado aparece com "(você)" e sem botão.
- **`StaffPage`**: loading, vazio e erro pelos componentes de estado do app; ordem coordenadores
  → servos → nome.
- **`menu/constants`**: `staff` visível para coordenador e servo; invisível para interno e servo
  de grupo de apoio. Atualizar o `constants.test.ts` existente.
- **Offline**: `staff.byHouse` está na allowlist (asserção no teste do persister/constants) e é
  pré-carregada no `prefetch`.
- **`LeaderPickerModal`** continua listando os servos pela key nova.

### `ops.fonte`: offline e2e (Playwright web, `e2e-web/`)

Com a casa aquecida online, ficar offline e recarregar o app: a tela *Servos* abre com a lista
vinda do cache, sem erro de rede.

### `ops.fonte`: Maestro (`pnpm test:ops`)

Fluxo: menu → *Servos* → a lista mostra o servo do seed. Somente leitura.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` (sem reduzir `house`) e
`pnpm test:ops:unit` com cobertura: `features/staff` ≥90%. Sem `skip`/`only`/`xfail` sem
justificativa explícita no código.

---

## Fora de escopo

- **Detalhe/ficha do servo no `ops`** (dados pessoais, anexos, permissões): continua no `adm`.
- **Criar, editar ou excluir servo pelo `ops`.**
- **Busca/filtro** na lista (decisão 8).
- **Ligação telefônica** além do WhatsApp.
- **`app.fonte`**: familiares não veem a lista de servos.
