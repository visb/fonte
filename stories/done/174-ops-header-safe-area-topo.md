# Plan: header do ops.fonte cortado pela status bar — safe area centralizada

## Context

Relato do usuário: no `ops.fonte`, no header, o "Bem-vindo," aparece **cortado horizontalmente pela
metade** e o avatar fica colado no topo da tela. Pedido literal: "dar um padding top no header
todo".

Causa raiz: nenhum header do app consome o inset de safe area — cada um chutou um número fixo, e o
número do Dashboard é menor que a status bar do aparelho.

| Arquivo | Padding de topo hoje | Situação |
|---|---|---|
| `features/dashboard/components/WelcomeHeader.tsx:18` | `pt-6` (24px) | **é a tela do relato** |
| `features/profile/components/ProfileHeader.tsx:16` | `pt-8` (32px) | chutado |
| `features/support-groups/pages/SupportGroupsPage.tsx:42` | `pt-12` (48px) | chutado |
| `features/residents/components/ResidentDetailHeader.tsx:72` | `insets.top` | correto |
| `components/OfflineBanner.tsx:28` | `insets.top + 8` | correto |

Três valores diferentes para o mesmo problema é a prova de que o ajuste vinha sendo feito no olho,
por tela, até parecer certo no aparelho de quem testou.

**A armadilha que define o desenho:** `app/(app)/_layout.tsx:33` renderiza o `OfflineBanner` *acima*
das `Tabs`, e o banner já paga `insets.top`. Se cada header passar a somar `insets.top` por conta
própria, o app ganha **gap duplo sempre que estiver offline** — que no `ops.fonte` é o estado
esperado, não a exceção. Qualquer correção distribuída por header teria que carregar um
`isOnline ? insets.top : 0` replicado em cada arquivo.

Decisões travadas nesta sessão de planning:

1. **Consumir o inset uma única vez, no wrapper de `app/(app)/_layout.tsx`** (escolha do usuário
   sobre a alternativa de corrigir só o `WelcomeHeader`). O gap duplo deixa de ser possível por
   construção, os três números chutados somem, e header novo criado no futuro não precisa lembrar
   do notch. `OfflineBanner` e `ResidentDetailHeader` **perdem** o `insets.top` próprio na mesma
   passada — com o inset pago pelo wrapper, o que hoje está certo passaria a ser gap duplo.
2. **O wrapper pinta `#272950`**, para a faixa da status bar continuar na cor do header e não
   aparecer uma tira branca acima dele.
3. **Correção de premissa sobre a StatusBar:** o levantamento inicial desta sessão supôs que a
   `StatusBar` não estava configurada. Está — `app/(app)/_layout.tsx:32` já tem
   `<StatusBar style="light" backgroundColor="#272950" />`. O usuário aprovou incluir StatusBar no
   escopo, então o que sobra de trabalho real é: **remover a prop `backgroundColor`** (é Android-only
   e vira no-op sob edge-to-edge; com o wrapper da decisão 2 pintando a faixa, ela é redundante e
   mascara o comportamento real) e **configurar a StatusBar do grupo `(auth)`**, que hoje não tem
   nenhuma — as telas de login são `bg-white` e precisam de `style="dark"`.
4. **Hipótese de edge-to-edge fica registrada, não vira dependência.** `app.json` não declara
   `edgeToEdge` nem `androidStatusBar`, e o app é Expo SDK 52 / RN 0.76.6 com `newArchEnabled:
   false`. Em Android 15 (API 35) o sistema **impõe** edge-to-edge independente da config, o que
   explicaria o conteúdo subir por baixo da status bar e o `backgroundColor` da StatusBar não pintar
   nada. É a explicação mais provável do relato, mas **não foi confirmada em device** — e não
   precisa ser: consumir o inset é a correção certa nos dois cenários. Não mexer em `targetSdk` nem
   adicionar o plugin `react-native-edge-to-edge` nesta story.
5. **`app.fonte` fica de fora.** É o mesmo tipo de defeito em potencial, mas o relato é do
   `ops.fonte` e o `app.fonte` tem estrutura de layout própria; misturar os dois dobra a superfície
   de teste em device. Abrir item no BACKLOG se o problema se confirmar lá.

## Desenho

### `app/(app)/_layout.tsx` — ponto único de safe area

- `useSafeAreaInsets()` no `AppLayout`.
- O `View className="flex-1"` de `_layout.tsx:31` (que hoje envolve `StatusBar` + `OfflineBanner` +
  `Tabs`) ganha `style={{ paddingTop: insets.top, backgroundColor: '#272950' }}`.
- `<StatusBar style="light" />` — sem `backgroundColor` (decisão 3).
- Inset de baixo (`insets.bottom`) **não** entra aqui: a tab bar do `expo-router`/React Navigation
  já trata o próprio inset inferior. Adicionar `paddingBottom` no wrapper criaria faixa morta sob a
  tab bar.
- Conferir que o wrapper cobre também o modo Resident (`UsageTimerProvider` / `resident-home`) e as
  telas com `href: null` que ficam fora da tab bar mas dentro do grupo (`residents/[id]`,
  `incidents`, `activities`, …) — todas são `Tabs.Screen` do mesmo layout, logo herdam o wrapper.

### Headers — remover os paddings chutados

- `features/dashboard/components/WelcomeHeader.tsx:18` — `pt-6` → `pt-4` (respiro interno do header,
  não compensação de status bar).
- `features/profile/components/ProfileHeader.tsx:16` — `pt-8` → `pt-4`.
- `features/support-groups/pages/SupportGroupsPage.tsx:42` — `pt-12` → `pt-4`.
- `features/residents/components/ResidentDetailHeader.tsx:72` — remover `paddingTop: insets.top` (e
  o `useSafeAreaInsets` se ficar sem uso no arquivo); manter o `backgroundColor: '#272950'`.
- `components/OfflineBanner.tsx:28` — `paddingTop: insets.top + 8` → `paddingTop: 8` (e remover o
  `useSafeAreaInsets`, que fica sem uso).
- O valor `pt-4` é o mesmo nos três headers de propósito: eles passam a ter respiro idêntico, que é
  o que o usuário está pedindo ao dizer "padding top no header todo".

### `app/(auth)/_layout.tsx`

- Hoje é só `<Stack screenOptions={{ headerShown: false }} />`. Adicionar `<StatusBar style="dark" />`
  — as telas de auth são `bg-white` e herdariam o `style="light"` do grupo `(app)` na navegação de
  volta, deixando os ícones brancos sobre fundo branco.
- As telas de auth centralizam o conteúdo (`flex-1 justify-center`), então **não** precisam de
  `paddingTop` de inset.

### Pontos de atenção

- **Web.** O `ops.fonte` roda em web (é onde moram os testes de offline em `e2e-web/`). Em web
  `insets.top` é `0`, então o wrapper vira no-op e nada deve mudar visualmente — confirmar que os
  specs Playwright existentes não quebram por deslocamento de layout.
- **Não usar `<SafeAreaView>`** no wrapper: com o `OfflineBanner` dentro, o `SafeAreaView` aplicaria
  o inset e ainda deixaria o banner sem a faixa colorida no topo em alguns aparelhos. O
  `paddingTop` explícito é previsível e é o padrão já usado no repo (`ResidentDetailHeader`).

## Validação

Gate: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail` sem justificativa
explícita no código.

Story é frontend-only, um único app — sem backend, sem migration, sem mudança de contrato, sem
alteração no `fonte-api.postman_collection.json`.

- `pnpm test:ops:unit` — todos os testes usam o mock de `react-native-safe-area-context` já
  estabelecido em `components/OfflineBanner.test.tsx:1-3`
  (`useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 })`):
  - **novo teste de `app/(app)/_layout.tsx`**: o wrapper aplica `paddingTop` igual a `insets.top` e
    `backgroundColor: '#272950'`. É o teste que trava a regressão principal.
  - `components/OfflineBanner.test.tsx`: atualizar — o banner agora tem `paddingTop: 8` fixo e
    **não** depende mais do inset; o caso deve falhar se alguém reintroduzir `insets.top` (é a
    regressão do gap duplo).
  - `features/dashboard/components/DashboardComponents.test.tsx`: o `WelcomeHeader` continua
    renderizando "Bem-vindo,", o nome e a casa; ajustar qualquer asserção de className presa ao
    `pt-6`.
  - `features/residents/components/ResidentTabsAndModals.test.tsx`: já mocka safe area; garantir que
    o `ResidentDetailHeader` sem `insets.top` continua verde.
- `pnpm test:ops:unit` com cobertura — o `AppLayout` passa a ter lógica testável (o cálculo do
  wrapper); o código novo entra coberto.
- `pnpm test:ops` (Maestro) — rodar os fluxos que passam pelo Dashboard e pelo detalhe do filho
  (`e2e/helpers/login-operator.yaml` + fluxos que dependem do header) para confirmar que nada saiu
  da área tocável.
- E2E web (`apps/ops.fonte/e2e-web/`) — devem continuar verdes **sem edição**; se precisarem de
  ajuste de posição, é sinal de que o wrapper mudou o layout em web, onde `insets.top` é `0`, e isso
  precisa ser investigado em vez de acomodado no teste.
- **Verificação manual obrigatória em device/emulador Android** (não substitui os testes, mas é o
  único jeito de fechar o relato original, já que `insets.top` é `0` no jsdom e em web):
  - Dashboard: "Bem-vindo," inteiro e avatar descolado do topo;
  - com a rede desligada: header **não** ganha gap duplo abaixo do `OfflineBanner`;
  - Perfil, Grupos de Apoio e detalhe do filho com o mesmo respiro de topo;
  - ícones da status bar legíveis sobre o `#272950`;
  - telas de login com ícones escuros legíveis sobre o fundo branco.
  - Testar em aparelho **Android 15** se houver um disponível, por causa da hipótese da decisão 4.

## Fora de escopo

- `app.fonte`, `adm.fonte` e `portal.fonte` (decisão 5).
- Adotar o plugin `react-native-edge-to-edge` ou mexer em `targetSdk` / `newArchEnabled`
  (decisão 4).
- Redesenho visual dos headers (cores, tipografia, hierarquia) — a story só corrige o recorte no
  topo e uniformiza o respiro.
- Extrair um componente `AppHeader` compartilhado entre Dashboard, Perfil e Grupos de Apoio; os três
  seguem com layouts próprios.
- Inset inferior / gestos de navegação e tab bar.
- Modo landscape (o app é `orientation: portrait` no `app.json`).
