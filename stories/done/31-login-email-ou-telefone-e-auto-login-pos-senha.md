# Plan: Login por e-mail ou telefone + auto-login após definir senha no primeiro acesso

## Context

Dois ajustes de autenticação pedidos pelo usuário:

1. **Login por e-mail OU telefone** — filhos (RESIDENT), servos (STAFF) e familiares
   (RELATIVE) devem conseguir logar informando e-mail **ou** telefone no mesmo campo. Hoje
   `LoginDto` só aceita e-mail (`@IsEmail`) e o `users` table nem tem coluna de telefone — o
   telefone vive nos perfis: `staff.phone`, `relatives.phone`, `residents.contact_phone`
   (todos `nullable`, **não únicos**).

2. **Auto-login após definir a senha no primeiro acesso (app.fonte)** — ao definir a senha no
   primeiro login, em vez de cair de novo na tela de login, o usuário deve ser logado
   automaticamente e ir para a home.

### Investigação do item 2

O backend já devolve token fresco em `POST /auth/change-password`, e os três apps
(`app.fonte`, `ops.fonte`, `adm.fonte`) já guardam esse token, buscam o `me` e redirecionam
para a home. **Nenhum** redireciona de propósito para o login depois de definir a senha.

A diferença está no `app.fonte`: o `ops.fonte/app/(auth)/login.tsx` tem um efeito de
recuperação — `useEffect(() => { if (token) router.replace('/(app)') }, [token])` — que joga o
usuário para a home assim que existe token. O **`app.fonte/app/(auth)/login.tsx` não tem esse
efeito**. Então, se o `(app)/_layout` em algum instante vê `token` ainda nulo logo após a troca
de senha e faz bounce para `/(auth)/login`, o familiar **fica preso** no login — não há
token-watch para recuperar. Isso explica o sintoma ser observado só no `app.fonte` (familiar).

### Decisões do usuário (travadas)

- **Campo único** "E-mail ou telefone" nas três telas de login (decisão de UX padrão).
- **Telefone ambíguo → rejeitar.** Telefone não é único entre staff/relatives/residents; se o
  telefone normalizado casar com **mais de um usuário distinto**, recusar o login com
  `Credenciais inválidas` (mesma resposta de credencial inválida — não vaza ambiguidade).
- **Escopo do login por telefone = os 3 perfis.** Staff (`staff.phone`), Relative
  (`relatives.phone`) e Resident (`residents.contact_phone`). Aceito que o `contact_phone` do
  interno costuma ser o telefone do familiar.
- **Item 2 = correção real no `app.fonte`** (espelhar o efeito de recuperação do `ops.fonte`),
  não só teste.

### Decisão técnica (travada)

- A resolução telefone → usuário fica em `UserService` via **uma query raw com UNION** sobre
  `staff`/`relatives`/`residents`, normalizando o telefone com
  `regexp_replace(phone, '\D', '', 'g')`, filtrando `deleted_at IS NULL` e `user_id IS NOT NULL`,
  retornando `DISTINCT user_id`. Trade-off aceito: é uma leitura cross-table dentro do
  `UserService` (camada de persistência adjacente à auth), preferida a criar métodos em
  `StaffService`/`RelativeService`/`ResidentService` + importá-los no `AuthModule` (risco de
  ciclo de módulos e mais superfície). A volumetria de login é baixa; sem índice dedicado.
- Detecção e-mail vs telefone: se o identificador contém `@` → e-mail; senão → telefone
  (normaliza para dígitos antes de consultar).

## Desenho

### Backend (`services/api`)

**`auth/dto/login.dto.ts`**
- Trocar `email: string` (`@IsEmail`) por `identifier: string` (`@IsString` + `@IsNotEmpty`).

**`user/user.service.ts`**
- Novo método `findActiveUserIdsByPhone(digits: string): Promise<string[]>`:
  - query raw via `repository.manager.query(...)` com UNION ALL das três tabelas
    (`staff.phone`, `relatives.phone`, `residents.contact_phone`), filtros
    `deleted_at IS NULL AND user_id IS NOT NULL`, comparando
    `regexp_replace(phone, '\D', '', 'g') = $1`, `SELECT DISTINCT user_id`.
  - Retorna lista de `user_id` distintos.

**`auth/auth.service.ts`** — `login(dto)`:
- `const identifier = dto.identifier.trim()`.
- Se `identifier.includes('@')` → `user = await userService.findByEmail(identifier)`.
- Senão → `digits = identifier.replace(/\D/g, '')`; se vazio → `UnauthorizedException`;
  `ids = await userService.findActiveUserIdsByPhone(digits)`; se `ids.length !== 1` →
  `UnauthorizedException('Credenciais inválidas')` (0 = não achou, >1 = ambíguo);
  `user = await userService.findById(ids[0])`.
- Resto inalterado (checa `isActive`, `bcrypt.compare`, gera token + `profileType`).

### Tipos compartilhados (`packages/api-client/src/types.ts`)
- `LoginInput`: `email` → `identifier`.

### Frontends — telas de login (relabel + enviar `identifier`)
- **adm.fonte**: `LoginPage`/`LoginForm` — label "E-mail ou telefone", schema `z.string().min(1)`
  (não `.email()`), envia `identifier`; `AuthContext.login(identifier, password)` →
  `api.auth.login({ identifier, password })`.
- **ops.fonte**: `app/(auth)/login.tsx` — relabel campo; `lib/auth.tsx` `login` envia
  `identifier`.
- **app.fonte**: `features/auth/components/LoginForm.tsx` — schema `email` → string `min(1)`,
  label "E-mail ou telefone", remover `keyboardType="email-address"`/`autoCapitalize`,
  enviar `identifier`; `lib/auth.tsx` `login` envia `identifier`.

### Item 2 — correção do auto-login no `app.fonte`
- `app/(auth)/login.tsx`: adicionar `const { token } = useAuth();` +
  `useEffect(() => { if (token) router.replace('/(app)'); }, [token]);` (espelha o `ops.fonte`).
  Garante que, havendo token (inclusive logo após definir a senha), o familiar vai para a home.

### Item 2 — verificar os outros apps
Antes de fechar, validar manualmente o auto-login pós-senha de primeiro acesso **nos três apps**,
não só no `app.fonte`:
- **ops.fonte** (STAFF e RESIDENT): primeiro login → definir senha → deve cair direto na home,
  sem voltar ao login. Já tem o efeito de recuperação no `login.tsx`; confirmar que segue válido.
- **adm.fonte** (ADMIN/COORDINATOR): primeiro login → definir senha → home. Confirmar que
  `ProtectedRoute` (token novo com `mustChangePassword=false`) não rebate para `/login`.
- Se qualquer um apresentar o mesmo bounce do `app.fonte`, aplicar a mesma correção
  (efeito token-watch / garantir token antes de navegar) no app afetado.

### Postman
- `fonte-api.postman_collection.json`: body do `Login` — `"email"` → `"identifier"`.

## Validação

- **Backend unit**: atualizar `auth.service.spec.ts` (`{email}` → `{identifier}`) e adicionar:
  login por telefone com 1 match; rejeita telefone ambíguo (2 matches); rejeita telefone
  desconhecido. Mockar `findActiveUserIdsByPhone`. `pnpm test:api` verde.
- **Backend e2e**: atualizar `test/helpers/e2e-app.ts` para enviar `{ identifier: email, password }`
  (mantém a assinatura `login(app, email, password)` e todos os e2e existentes verdes).
  `pnpm test:api:e2e` verde.
- **adm e2e**: `apps/adm.fonte/e2e/auth.spec.ts` continua passando (login por e-mail no mesmo
  campo). Rodar `pnpm test:adm` do spec de auth.
- **Auto-login pós-senha nos 3 apps**: verificar manualmente o fluxo de primeiro acesso
  (login → definir senha → home, sem voltar ao login) em `app.fonte`, `ops.fonte` e `adm.fonte`.
- Typecheck/build dos pacotes alterados (`pnpm build:types`, `pnpm build:api-client`).

## Fora de escopo

- Coluna de telefone normalizada/única em `users` ou índice dedicado (volumetria baixa).
- Recuperação de senha / "esqueci a senha".
- `resident.fonte` (não scaffoldado).
- Mudança no fluxo de change-password do `ops.fonte`/`adm.fonte` (já funcionam).
