# Plan: cards do dashboard do `ops.fonte` — Filhos e Servos clicáveis

## Context

A tela inicial do `ops` mostra dois contadores estáticos em
`features/dashboard/components/StatCards.tsx`: "Filhos na casa" e "Ocorrências hoje". Nenhum é
tocável. O operador vê o número de filhos e precisa ir ao menu para abrir a lista. O contador de
ocorrências do dia tem pouco uso. O de servos, que a casa consulta com frequência desde a lista da
story 204, não existe.

Pedido do usuário (BACKLOG, dois itens unidos nesta story porque mexem no mesmo componente):
- o card com o número de filhos deve levar à listagem de filhos ao ser tocado;
- adicionar um card com o contador de servos no lugar do contador de ocorrências.

### Decisões travadas (usuário)

1. **Os dois itens viram uma story só**, já que tocam o mesmo componente.
2. **Card Servos conta os servos ativos da casa e, ao toque, abre `/(app)/staff`.** A fonte é
   `useHouseStaff(houseId)` (story 204). O endpoint `GET /houses/:id/staff` já filtra servos ativos
   (`activeStaffSql`), e a query é pré-carregada e persistida offline. Não há fetch novo.
3. **"Ocorrências hoje" sai do dashboard.** Some o card e o `useIncidentsToday` do
   `DashboardPage` (incluindo o refetch do pull-to-refresh). A ação rápida "Nova ocorrência"
   continua.

### Decisões de desenho (defaults assumidos no refino)

4. **A navegação respeita o catálogo do menu (story 176).** Cada card só é tocável quando
   `canAccessMenuItem('residents' | 'staff', access)` é verdadeiro. Sem acesso, o card aparece sem
   `onPress` (não é botão). Rotas vêm de `MENU_ITEMS`, não string solta na tela.
5. **O card de filhos mantém a contagem atual** (status em `PRESENT_RESIDENT_STATUSES`). A lista
   aberta pelo toque é a lista de filhos padrão, sem filtro pré-aplicado.
6. **Offline:** o toque funciona sem sinal. As duas listas já são leituras persistidas
   (allowlist em `lib/offline/constants.ts`). Nada muda na allowlist.

---

## Desenho

### `ops.fonte`

```
features/dashboard/components/StatCards.tsx  ← vira lista de StatCard; props residentCount, staffCount + onPress opcionais
features/dashboard/components/StatCard.tsx   ← novo; um card (número, rótulo, onPress opcional, chevron quando tocável)
features/dashboard/pages/DashboardPage.tsx   ← troca useIncidentsToday por useHouseStaff; refresh refaz residents + staff
features/menu/hooks/useMenuAccess.ts         ← expor canAccess(key) se ainda não expõe (para decidir o onPress)
```

- `StatCard`: `Pressable` com `accessibilityRole="button"` e `accessibilityLabel` ("Ver filhos",
  "Ver servos") quando tem `onPress`. Sem `onPress`, `View` simples. `testID` estável por card
  (`stat-card-residents`, `stat-card-staff`) para o Maestro.
- `DashboardPage`: `staffCount = staff.length` de `useHouseStaff(staff?.houseId)`. O
  `router.push` usa a rota do item do catálogo (`MENU_ITEMS`).
- Rótulos: "Filhos na casa" e "Servos na casa".
- Se `useIncidentsToday` ficar sem uso no app, remover o hook e a query key correspondente (e a
  entrada no prefetch/allowlist, se houver). Conferir antes com grep.

---

## Validação

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- **`StatCard`**: com `onPress` é botão e dispara o callback; sem `onPress` não é botão.
- **`StatCards`**: renderiza "Filhos na casa" e "Servos na casa" com os números recebidos; não
  renderiza mais "Ocorrências hoje".
- **`DashboardPage`**:
  - toque no card de filhos → `router.push` para a rota de `residents`;
  - toque no card de servos → `router.push` para a rota de `staff`;
  - perfil sem acesso ao item (ex.: interno) → card sem toque;
  - contador de servos = tamanho da lista de `useHouseStaff`;
  - pull-to-refresh refaz residents e staff.
- Atualizar `DashboardComponents.test.tsx` (hoje espera o card de ocorrências).
- Se remover `useIncidentsToday`/query key: atualizar os testes de prefetch/persister afetados.

### `ops.fonte`: Maestro (`pnpm test:ops`, `e2e/dashboard.yaml`)

- Dashboard mostra "Servos na casa" e não mostra "Ocorrências hoje".
- Tocar `stat-card-residents` abre a lista de filhos; voltar; tocar `stat-card-staff` abre a
  lista de servos.

### `ops.fonte`: web offline (`e2e-web/`, Playwright)

- `context.setOffline(true)` após aquecer o cache: os dois cards mostram o número em cache e o
  toque abre as listas.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente. Código novo sem teste não fecha a story.
Rodar a cobertura de `pnpm test:ops:unit`, **sem reduzir** a cobertura de `features/dashboard`.
Componentes novos ≥90%. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).
Backend não muda (sem `test:api` obrigatório além do pré-commit padrão).

---

## Fora de escopo

- Card de ocorrências em outro lugar do dashboard (decisão 3).
- Filtro pré-aplicado na lista de filhos ao vir do card.
- Ordenação da lista de filhos (story própria do mesmo backlog).
- Contadores novos além de filhos e servos.
