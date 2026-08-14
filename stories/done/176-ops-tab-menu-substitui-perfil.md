# Plan: ops.fonte — tab "Menu" no lugar de "Perfil"

## Context

Hoje a tab bar do `ops.fonte` tem **Início, Filhos, Mensagens, Pedidos, Perfil** (+ **Apoio** para
servo de grupo de apoio). Todo o resto do app — ocorrências, atividades, ministérios, dispensa,
almoxarifado, faturamento, eventos internos, contagem, configurações da casa, pendências de envio —
está registrado em `app/(app)/_layout.tsx` com `href: null` e só é alcançável pelos cards de
**Ações rápidas** do dashboard (`features/dashboard/components/QuickActions.tsx`). Quem sai do
dashboard não tem índice do app; "Pendências de envio" ([[170]]), por exemplo, só aparece quando o
`SyncQueueBadge` decide aparecer.

A tab **Perfil** ocupa um dos cinco slots da barra para uma tela que o operador abre raramente
(foto, dados, trocar senha). A troca: essa tab vira **Menu** — cabeçalho com foto/nome do usuário
logado e botão "Editar perfil", e abaixo o índice completo do app.

### Decisões travadas (usuário)

1. **Menu lista tudo que o usuário pode acessar**, filtrado por role/permissão — inclusive o que já
   está na tab bar (Filhos, Mensagens, Pedidos). Menu é o índice completo, não o complemento da
   barra.
2. **Ações rápidas do dashboard continuam.** Menu não substitui os atalhos de quem já usa o app.
   Consequência aceita: duas listas de rotas — resolvida com **catálogo único** compartilhado
   (`features/menu/constants.ts`), consumido pelo menu e pelo `QuickActions`.
3. **"Sair" sai do `WelcomeHeader` do dashboard** e vira o último item do menu, na seção "Conta",
   com o `SyncLogoutNotice` ([[169]]) junto — perder lançamento da fila no logout continua avisado
   onde a ação está.
4. **Layout: lista de linhas agrupadas** por seção (ícone + label + chevron), não grade de cards:

```
┌────────────────────────┐
│   (foto)  João Silva   │
│           Casa Bethel  │
│      [ Editar perfil ] │
└────────────────────────┘
CASA
 □ Filhos              >
 □ Ocorrências         >
 ...
CONTA
 □ Pendências de envio >
 □ Sair
```

5. **`/(app)/profile` continua existindo** como rota — só perde a tab (`href: null`) e passa a ser
   empurrada pelo botão "Editar perfil". A `ProfilePage` não muda.

### Trade-offs / cuidados

- **Regras de visibilidade já existem e não podem divergir.** Os `href` condicionais do
  `_layout.tsx` (`isResident`, `isSupportGroupServant`, `canSendMessagesToFamilies`,
  `canModerateMessages`) e as flags do `DashboardPage` (`isCoordinator` → contagem;
  `isHouseCoordinator` → configurações da casa) passam a ser a **mesma** função de filtro do
  catálogo. Duas fontes de verdade aqui viram item de menu que leva a tela proibida.
- **Servo de grupo de apoio segue sem tab bar** (`tabBarStyle: display none`) — regra atual
  preservada, a tab Menu nasce com o mesmo `href: null` que a Perfil tinha para ele.
- **Interno (`isResident`)** vê o Menu, mas com o catálogo reduzido ao que a role permite
  (mensagens, pedidos, editar perfil). O `resident-home` **mantém** seu próprio botão "Sair": é
  tela de kiosk com timer de uso, não passa a depender do menu.
- **Testes E2E quebram de propósito**: `e2e-web/dashboard.spec.ts` e `e2e/auth.spec.yaml` clicam em
  "Sair" no dashboard. Atualizar os dois faz parte da story.
- **Offline**: menu é navegação estática, não faz fetch — funciona sem sinal. Item "Pendências de
  envio" é o caminho fixo para `/sync` ([[170]]), que hoje só aparece via badge condicional.
- Sem mudança de backend, contrato ou Postman.

## Desenho

### 1. Catálogo de navegação — `features/menu/constants.ts` (novo)

- `AppMenuItem`: `{ key, label, icon, route, section, color?, bg? }`.
- `MENU_SECTIONS`: `'casa' | 'estoque' | 'comunicacao' | 'conta'` com rótulos
  ("Casa", "Estoque", "Comunicação", "Conta").
- `buildMenuItems(access): AppMenuItem[]` — recebe um objeto de acesso
  (`isResident`, `isSupportGroupServant`, `isCoordinator`, `isHouseCoordinator`,
  `canSendMessagesToFamilies`, `canModerateMessages`) e devolve só o permitido.
  Rotas cobertas: `residents`, `incidents`, `activities`, `ministries`, `census`,
  `house-settings`, `storeroom`, `supply-room`, `street-sales`, `events`, `messages`,
  `wishlist`, `support-groups`, `sync`.
- `QUICK_ACTION_KEYS`: as chaves que o dashboard destaca — `QuickActions` passa a montar seus
  cards a partir do mesmo catálogo em vez da lista local.

### 2. Hook de acesso — `features/menu/hooks/useMenuAccess.ts` (novo)

- Junta `useAuth()` com a consulta de casa já usada pelo dashboard (`useHouseById`, `enabled:
  isCoordinator`) e devolve o objeto de acesso do `buildMenuItems`. `DashboardPage` passa a
  consumir esse hook em vez de recalcular `isHouseCoordinator` na page.

### 3. Tela — `features/menu/pages/MenuPage.tsx` + componentes

- `MenuProfileCard` — foto (`resolveAssetUrl`), nome, subtítulo (casa / grupo de apoio / "Filho"),
  botão **Editar perfil** → `router.push('/(app)/profile')`.
- `MenuSection` — título da seção.
- `MenuRow` — ícone + label + chevron, `testID` estável por `key` (`menu-item-<key>`).
- `MenuLogoutRow` — "Sair" + `SyncLogoutNotice` acima; chama `logout()` do `useAuth`.

### 4. Rotas — `app/(app)/`

- `menu.tsx` (novo) renderiza `MenuPage`; `Tabs.Screen name="menu"` assume o slot, título "Menu",
  ícone `menu-outline`, mesma condição de `href` que a Perfil tinha.
- `Tabs.Screen name="profile"` passa a `href: null` (rota continua acessível por push).

### 5. Dashboard

- `WelcomeHeader`: remove o botão "Sair" (mantém `NotificationBell`); a prop/uso de `logout` sai.
- `QuickActions`: passa a receber os itens do catálogo (`QUICK_ACTION_KEYS` filtrados pelo acesso),
  visual inalterado.

## Validação

Frontend-only, um app (`ops.fonte`). Backend, contratos e Postman não mudam.

### Testes obrigatórios

**Unit (`pnpm test:ops:unit`)** — casos a cobrir:

- `buildMenuItems`, por perfil: **servo com casa** vê o pacote da casa e não vê contagem nem
  configurações da casa; **coordenador** ganha contagem; **coordenador da própria casa** ganha
  configurações da casa; **interno** vê só mensagens/pedidos (nenhuma rota de casa, estoque ou
  faturamento); **servo de grupo de apoio** vê apoio e não vê rotas de casa; mensagens/pedidos
  aparecem só com `canSendMessagesToFamilies`/`canModerateMessages` correspondentes.
- **Trava de paridade**: teste que compara o catálogo com as regras de `href` do `_layout.tsx` —
  nenhum item de menu aponta para rota que o mesmo perfil não pode abrir, e nenhuma rota visível na
  tab bar fica fora do catálogo.
- `MenuPage`: renderiza nome, subtítulo e foto do usuário logado; sem foto cai no placeholder;
  "Editar perfil" navega para `/(app)/profile`; cada linha navega para sua rota; seções vazias não
  renderizam título órfão.
- Logout: pressionar "Sair" chama `logout()`; `SyncLogoutNotice` está presente na seção Conta.
- `QuickActions`: continua renderizando os mesmos rótulos de hoje a partir do catálogo (protege
  contra regressão silenciosa do dashboard).
- `WelcomeHeader`: **não** renderiza mais "Sair" e segue renderizando o sino de notificações
  (atualizar `DashboardComponents.test.tsx`, que hoje pressiona "Sair").

**E2E web (`pnpm test:ops:e2e`, Playwright, `e2e-web/`)**:

- `dashboard.spec.ts`: atualizar o fluxo de logout — agora abre a tab Menu e clica "Sair".
- Spec nova (ou bloco em `dashboard.spec.ts`): tab **Menu** abre; cabeçalho mostra nome do usuário;
  "Editar perfil" leva à tela de perfil; um item de cada seção navega para a rota certa;
  a tab "Perfil" **não** existe mais na barra.
- Specs offline ([[168]]–[[171]]) continuam verdes.

**Maestro (`pnpm test:ops`)**: atualizar `e2e/auth.spec.yaml` (o `tapOn: "Sair"` agora exige abrir
o Menu antes) e rodar a suíte.

### Gate de cobertura (trava a story)

> Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste.
> Rodar `pnpm test:ops:unit:cov`; **não reduzir** a cobertura de `features/menu/`,
> `features/dashboard/` e `features/profile/`. Sem `skip`/`only`/`xfail` sem justificativa no
> código (CLAUDE.md).

## Fora de escopo

- Mudar a `ProfilePage` (foto, dados, trocar senha continuam como estão).
- Mexer nas outras tabs (Início, Filhos, Mensagens, Pedidos, Apoio) ou no `resident-home`, que
  mantém seu próprio "Sair".
- Busca dentro do menu, favoritos ou ordenação personalizada de itens.
- Badge de contador nos itens do menu (ex.: nº de pendências em `/sync`).
- `app.fonte`, `adm.fonte`, `portal.fonte`.
