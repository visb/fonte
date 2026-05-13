# app.fonte

App mobile para **familiares e responsáveis** (role `RELATIVE`) de residentes da Fonte de Misericórdia.

---

## Stack técnica

- **Expo ~52** + **expo-router ~4** (file-based navigation)
- **React Native 0.76** + **NativeWind ^4** (Tailwind para RN)
- **@tanstack/react-query ^5** (cache e sincronização de dados)
- **react-hook-form + zod** (formulários — quando existirem)
- **expo-camera** (QR scan para check-in)
- **@fonte/api-client** (cliente HTTP compartilhado com ops.fonte e adm.fonte)
- **@fonte/types** (enums e contratos compartilhados)

---

## Arquitetura

### Estrutura de pastas

```
apps/app.fonte/
  app/
    _layout.tsx              ← root: QueryClientProvider + AuthProvider
    (auth)/
      _layout.tsx
      login.tsx              ← login por email + senha
      change-password.tsx    ← troca de senha obrigatória
    (app)/
      _layout.tsx            ← tab bar (4 tabs fixas)
      index.tsx              ← Início
      messages.tsx           ← Mensagens
      wishlist.tsx           ← Pedidos
      checkin.tsx            ← Check-in QR
  features/
    home/
      hooks/useRelativeMe.ts
      pages/HomePage.tsx
    messages/
      hooks/useMessages.ts
      components/MessageBubble.tsx
      components/MessageInput.tsx
      pages/MessagesPage.tsx
    wishlist/
      hooks/useWishlist.ts
      components/WishlistItemCard.tsx
      pages/WishlistPage.tsx
    checkin/
      hooks/useCheckin.ts
      pages/CheckinPage.tsx
  lib/
    api.ts        ← createApiClient com baseURL e token storage
    auth.tsx      ← AuthContext (RELATIVE profileType)
    queryKeys.ts  ← todas as query keys
    errors.ts     ← getErrorMessage
  components/
    shared/
      LoadingState.tsx
      EmptyState.tsx
      ErrorState.tsx
```

### Fluxo de autenticação

1. Login com email + senha → backend retorna `{ accessToken, profileType: 'RELATIVE' }`
2. `auth.tsx` chama `GET /relatives/me` → armazena `RelativeMe` em `AsyncStorage`
3. `RelativeMe` contém: id, userId, name, residentId, residentName, houseName, houseAddress, etc.
4. `useAuth()` expõe `{ token, relative, isLoading, login, logout, changePassword }`
5. Sessão é restaurada do AsyncStorage no boot

### Identidade do familiar

Um familiar (`Relative`) está vinculado a **um único residente**. O `RelativeMe` inclui:
- `id` — ID do familiar (usado no par de conversa)
- `userId` — ID do usuário autenticado (para identificar mensagens enviadas)
- `residentId`, `residentName` — filho vinculado
- `houseId`, `houseName`, `houseAddress`, etc. — info da casa para a tela Início

---

## Features

### Início (`/`)
- Exibe perfil do familiar e info do filho
- Endereço, telefone e coordenador da casa
- Botão de logout

### Mensagens (`/messages`)
- Thread direta com o residente vinculado
- Mensagens enviadas pelo familiar → `PENDING_APPROVAL` (aguardam aprovação do servo)
- Polling automático a cada 15s
- Badge "aguardando aprovação" nas mensagens pendentes

### Pedidos (`/wishlist`)
- Lista de itens **aprovados** da lista de pedidos do residente
- Read-only (familiar visualiza, residente gerencia via ops.fonte ou resident.fonte)

### Check-in (`/checkin`)
- Câmera escaneia QR code da reunião do grupo de apoio
- Token é enviado para `POST /support-groups/relative-checkin`
- Resultado de sucesso/erro exibido inline

---

## Backend dependências

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `POST /auth/login` | auth | Login |
| `POST /auth/change-password` | auth | Troca de senha |
| `GET /relatives/me` | RELATIVE | Self-profile + info da casa |
| `GET /messages/conversations/:residentId/:relativeId` | RELATIVE | Thread com filho |
| `POST /messages` | RELATIVE | Enviar mensagem (→ PENDING_APPROVAL) |
| `GET /wishlist/:residentId` | RELATIVE | Itens aprovados do filho |
| `POST /support-groups/relative-checkin` | RELATIVE | Check-in via token QR |

---

## Como rodar

```bash
# da raiz do monorepo
pnpm install
pnpm docker:up    # sobe o banco
pnpm dev:api      # API NestJS na porta 3000

# no diretório do app
cd apps/app.fonte
npx expo start    # ou: pnpm start
```

Variável de ambiente opcional:
```
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api/v1
```
(necessário para testar em dispositivo físico na rede local)

---

## Gerar acesso para familiar

Feito no **adm.fonte** → tela de detalhe do residente → aba "Familiares" → botão da chave ao lado do familiar. Isso cria um `User` com `role: RELATIVE` e `mustChangePassword: true`.

No primeiro login, o familiar é redirecionado para `/change-password`.
