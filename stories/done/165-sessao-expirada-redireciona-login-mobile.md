# Plan: sessão expirada redireciona para login no ops.fonte e app.fonte

## Context

Relato do usuário: no `ops.fonte`, quando o token JWT expira, o app **não** vai para a tela de
login — continua exibindo a home, só que com todos os números zerados. Parece bug de dados, mas é
sessão morta.

Causa raiz confirmada no código:

- `packages/api-client/src/client.ts:45` só registra o interceptor de response (que trata 401)
  quando a config recebe `onUnauthorized`.
- `apps/adm.fonte/src/lib/api.ts` passa `onUnauthorized` (remove `fonte_token` do localStorage e
  navega para `/login`) — por isso o adm se comporta certo.
- `apps/ops.fonte/lib/api.ts:14` **não passa** `onUnauthorized`. O 401 apenas rejeita a query do
  React Query; o token continua no AsyncStorage e o `AuthProvider` continua com `token` no state.
  O guard `app/(app)/_layout.tsx:20` (`if (!isLoading && !token) router.replace("/(auth)/login")`)
  nunca dispara → home renderizada com listas vazias/zeros.
- `apps/app.fonte/lib/api.ts` tem exatamente o mesmo buraco.

Decisões travadas nesta sessão de planning:

1. **Escopo cobre os dois apps Expo** (`ops.fonte` e `app.fonte`). É o mesmo defeito, mesma
   correção; corrigir só um deixaria dívida idêntica aberta.
2. **UX: redirect + aviso "Sessão expirada"** na tela de login (não redirect silencioso como o
   adm). Sem a mensagem o usuário volta a achar que é bug.
3. **401 de login não pode disparar logout global.** A resposta 401 de `POST /auth/login`
   (credencial errada) e de `POST /auth/change-password` deve ser ignorada pelo handler — senão o
   erro de senha incorreta vira "sessão expirada" e limpa estado à toa.
4. **Não implementar refresh token.** O backend hoje emite só `accessToken`; renovação silenciosa
   é outro assunto, fora desta story.

Restrição de desenho: `lib/api.ts` é módulo, criado antes e fora da árvore React — não enxerga o
`AuthContext`. O handler precisa de uma ponte (callback/registry em `lib/api.ts` que o
`AuthProvider` registra no mount) para que a limpeza passe pelo `logout()` do context e o state em
memória (`token`, `staff`, `resident`) fique consistente com o AsyncStorage. Limpar o storage por
fora sem mexer no context deixa estado sujo e o guard continua sem disparar.

## Desenho

### `packages/api-client`

- Sem mudança de contrato esperada — `onUnauthorized` já existe. Se for preciso distinguir a rota
  que falhou (para ignorar `auth/login`), passar essa informação como argumento opcional do handler
  (ex.: `onUnauthorized?: (ctx: { url?: string }) => void`), mantendo compatibilidade com a
  assinatura sem parâmetro usada hoje pelo `adm.fonte`.
- Alternativa preferida se bastar: filtrar as rotas de auth dentro do próprio interceptor do
  client, para os três apps herdarem o comportamento correto sem duplicar regra.

### `apps/ops.fonte` e `apps/app.fonte` (mesma estrutura nos dois)

- `lib/api.ts`: exportar um registrador (`setUnauthorizedHandler(fn)`) e passar
  `onUnauthorized` ao `createApiClient`, delegando ao handler registrado (no-op se ninguém
  registrou ainda, para não quebrar chamadas antes do mount).
- `lib/auth.tsx`:
  - novo campo de estado `sessionExpired: boolean` no `AuthState`/`AuthContextValue`;
  - `useEffect` no `AuthProvider` registra o handler: ao 401 não-auth, executa a mesma limpeza do
    `logout()` (`AsyncStorage.multiRemove(['token','staff','resident'])` + reset do state) e marca
    `sessionExpired: true`;
  - `login()` bem-sucedido zera `sessionExpired`;
  - `logout()` manual **não** marca `sessionExpired` (sair por vontade própria não é expiração).
- `app/(app)/_layout.tsx`: nenhuma mudança necessária — o guard já reage a `token === null`.
  Confirmar que o `router.replace` roda a partir de qualquer tela filha, não só da home.
- `app/(auth)/login.tsx`: quando `sessionExpired`, renderizar aviso ("Sua sessão expirou. Entre
  novamente.") acima do formulário, reusando o mesmo bloco visual do `error` existente
  (`login.tsx:18`). O aviso some ao submeter o formulário.
- `app.fonte`: aplicar a versão equivalente na tela de login e no provider correspondentes.

### Pontos de atenção

- Requisições concorrentes que estouram 401 juntas não podem disparar N redirects — o handler deve
  ser idempotente (checar se já está deslogado antes de limpar/navegar).
- Modo Resident do `ops.fonte` (`UsageTimerProvider`, `resident-home`) também precisa cair para o
  login na expiração; verificar que o timer não segura a navegação.

## Validação

Gate: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail` sem justificativa
explícita no código.

- `pnpm build:api-client` — se `ApiClientConfig`/interceptor mudarem, o contrato precisa compilar
  para todos os consumidores.
- `pnpm test:api-client` — cobrir no `packages/api-client/src/client.test.ts`:
  - 401 em rota comum chama `onUnauthorized`;
  - 401 em `auth/login` **não** chama;
  - erro não-401 nunca chama;
  - client sem `onUnauthorized` segue sem registrar interceptor (regressão do teste atual).
- `pnpm test:ops:unit` (`apps/ops.fonte`, jest + @testing-library/react-native) — cobrir em
  `lib/auth.test.tsx` e num teste da tela de login:
  - handler de 401 limpa AsyncStorage, zera `token`/`staff`/`resident` e liga `sessionExpired`;
  - dois 401 seguidos não duplicam efeito (idempotência);
  - `logout()` manual não liga `sessionExpired`;
  - `login()` bem-sucedido desliga `sessionExpired`;
  - tela de login mostra o aviso quando `sessionExpired` e não mostra no estado normal.
- `pnpm test:app:unit` (`apps/app.fonte`) — mesmos casos do provider e da tela de login.
- `pnpm test:adm` — smoke de que o `adm.fonte` (único consumidor atual de `onUnauthorized`)
  continua deslogando e redirecionando.
- Cobertura: rodar os runners de cobertura dos escopos tocados
  (`pnpm test:ops:unit --coverage` / equivalente do `app.fonte`, `pnpm test:api-client` com
  cobertura); o código novo entra coberto.
- Verificação manual (não substitui os testes): logar no `ops.fonte`, invalidar o token
  (editar o valor no AsyncStorage ou esperar expirar), disparar qualquer navegação/refresh e
  confirmar o redirect para login com o aviso.

## Fora de escopo

- Refresh token / renovação silenciosa de sessão.
- Mudar tempo de expiração do JWT no backend.
- Alterar o comportamento do `adm.fonte` (que já redireciona) além do necessário para o contrato
  compartilhado continuar compilando.
- Aviso de "sessão prestes a expirar" / countdown.
- `portal.fonte` (público, sem login) e `resident.fonte` (não scaffoldado).
