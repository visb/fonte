# Plan: botão "ver senha" em todos os campos de senha

## Context

Pedido do usuário: adicionar botão "ver senha" nas páginas de login. Digitar senha às cegas em
teclado de celular, dentro da casa, é fonte recorrente de erro de digitação — e o operador não tem
como saber se errou a senha ou se o acesso está bloqueado.

Levantamento do estado atual (o pedido é maior do que parece):

- **`adm.fonte` já tem o toggle** — mas duplicado inline em 4 arquivos, com o mesmo bloco
  `<div className="relative"> + <Input type={show ? 'text' : 'password'} className="pr-9"> +
  <button absolute right-2> {show ? <EyeOff/> : <Eye/>}`:
  - `src/features/auth/components/ChangePasswordDialog.tsx:76,100`
  - `src/features/auth/pages/ChangePasswordPage.tsx:64,88`
  - `src/features/staff/components/ResetPasswordDialog.tsx:59`
  - `src/features/residents/components/ResetRelativePasswordDialog.tsx:59`
- **A `LoginPage` do `adm.fonte` é justamente a que ficou sem** —
  `src/features/auth/pages/LoginPage.tsx:70` é um `<Input type="password">` cru.
- **Nenhum campo de senha dos apps Expo tem toggle** — todos são `secureTextEntry` fixo
  (`ops.fonte`: login, change-password, ChangePasswordSection; `app.fonte`: LoginForm,
  ChangePasswordForm, PasswordChangeForm).

Decisões travadas nesta sessão de planning:

1. **Escopo é todo campo de senha do sistema, não só as telas de login.** Ter olho no login e não
   ter ao trocar a senha é pior que não ter em lugar nenhum — e a tela de definir senha no primeiro
   acesso (`ops.fonte/app/(auth)/change-password.tsx`) é onde o erro de digitação custa mais caro,
   porque o usuário grava uma senha que não sabe qual é.
2. **Um componente `PasswordInput` por plataforma, não um por app.** Web e React Native não
   compartilham UI, então são dois componentes: um em `adm.fonte/src/components/shared/` e um em
   RN. Como `ops.fonte` e `app.fonte` também não compartilham pasta de componentes, o componente RN
   é duplicado nos dois apps (mesma decisão já vigente para os demais componentes de estado).
   Extrair um pacote de UI RN compartilhado é outro assunto.
3. **`adm.fonte` é refactor, não feature nova.** O comportamento visual dos 4 lugares existentes
   fica idêntico; eles passam a consumir o `PasswordInput` extraído. A `LoginPage` ganha o toggle
   ao adotar o mesmo componente. Deixar a duplicação de pé e só copiar o bloco pela quinta vez na
   `LoginPage` é o resultado errado desta story.
4. **Migrar `ops.fonte/app/(auth)/login.tsx` para `react-hook-form` + `zod` + `Controller`** —
   decisão explícita do usuário nesta sessão. O arquivo usa `useState` para `identifier`/`password`
   e valida à mão dentro do `handleLogin`, violando a regra de formulários do `CLAUDE.md`. É o
   único login dos três apps ainda nesse formato (`app.fonte/features/auth/components/LoginForm.tsx`
   já está no padrão e serve de referência direta).
5. **`ops.fonte/app/(auth)/change-password.tsx` entra no mesmo refactor.** Tem exatamente a mesma
   violação (`useState` + validação manual de `length` e de igualdade das senhas) e o arquivo já
   será tocado para receber o `PasswordInput`. O schema `zod` correspondente já existe pronto em
   `features/profile/components/ChangePasswordSection.tsx:12-20` (`min(6)` + `refine` de
   confirmação) e deve ser reusado, não reescrito.
6. **Estado começa sempre oculto e nunca é persistido.** Nada de lembrar a preferência entre
   sessões ou telas: senha revelada é exposição a quem olha a tela, e no `ops.fonte` a tela é usada
   em ambiente coletivo. Cada campo tem seu próprio estado — revelar "nova senha" não revela
   "confirmar senha".

## Desenho

### `adm.fonte` — `src/components/shared/PasswordInput.tsx`

- Componente que encapsula o wrapper `relative`, o `Input` com `type` alternado, o `pr-9` e o botão
  absoluto com `Eye`/`EyeOff` (`lucide-react`, já em uso nos 4 arquivos atuais).
- Props: repassa as props do `Input` (`id`, `placeholder`, `className`, `disabled`, `value`,
  `readOnly`, e o spread de `register(...)`) e mantém `tabIndex={-1}` no botão, para o Tab do
  formulário continuar indo do campo direto para o próximo campo/submit.
- O botão ganha `aria-label` alternando entre `"Mostrar senha"` e `"Ocultar senha"` — hoje é um
  `<button>` sem nome acessível, e é o gancho que os testes vão usar para clicar.
- Estado `show` é interno ao componente (`useState`), um por instância.
- `ResetPasswordDialog` e `ResetRelativePasswordDialog` exibem senha **gerada** (com botão de
  copiar ao lado, `type="button" ... handleCopy`): ao adotar o componente, preservar o layout do
  botão de copiar convivendo com o olho — conferir o espaçamento à direita (o `pr-9` pode precisar
  virar prop/variação em vez de constante).

### `adm.fonte` — adoção

- `features/auth/pages/LoginPage.tsx:70` — troca `<Input id="password" type="password" ...>` pelo
  `PasswordInput` (é a mudança que originou a story).
- `features/auth/components/ChangePasswordDialog.tsx`, `features/auth/pages/ChangePasswordPage.tsx`,
  `features/staff/components/ResetPasswordDialog.tsx`,
  `features/residents/components/ResetRelativePasswordDialog.tsx` — remover o bloco inline e os
  `useState` de `showNew`/`showConfirm`/`showPassword`, consumindo o componente.

### `ops.fonte` e `app.fonte` — componente RN

- Criar `components/shared/PasswordInput.tsx` em cada app (mesmo arquivo, duplicado por app).
- Estrutura: `View` com `position: relative`, `TextInput` com `secureTextEntry={!show}` e padding à
  direita para não passar por baixo do ícone, e `TouchableOpacity` posicionado à direita com
  `Ionicons` `eye-outline` / `eye-off-outline` (`@expo/vector-icons`, já usado no repo).
- O componente é controlado (`value` / `onChangeText` / `onBlur`), para plugar direto no
  `render` do `Controller` sem inverter a responsabilidade do formulário.
- Props repassadas obrigatoriamente: `accessibilityLabel`, `placeholder`, `onSubmitEditing`,
  `className` (o `INPUT_CLASS` de cada tela é passado de fora, os apps têm temas diferentes —
  `ops.fonte` usa `#272950`/azul, `app.fonte` usa violeta).
- Botão com `accessibilityLabel` alternando `"mostrar-senha"` / `"ocultar-senha"` — é o seletor dos
  testes unitários e do Playwright web.
- **`accessibilityLabel` do input não pode mudar.** `input-senha` é usado pelos e2e existentes
  (`apps/ops.fonte/e2e-web/login.spec.ts`, `apps/app.fonte/e2e-web/login.spec.ts`, e os `.yaml` do
  Maestro em `e2e/`). Renomear quebra os fluxos de login de todos os e2e mobile.
- Cuidado conhecido de RN: alternar `secureTextEntry` em campo focado pode fazer o Android limpar o
  texto ou resetar o teclado. Validar em device/emulador Android que o valor digitado sobrevive ao
  toggle; se o problema aparecer, a saída usual é forçar remount controlado mantendo o `value` do
  formulário como fonte de verdade.

### `ops.fonte` — refactor dos formulários de auth (decisões 4 e 5)

- `app/(auth)/login.tsx`: substituir os `useState` de `identifier`/`password`/`error` por
  `useForm` + `zodResolver` + `Controller`, espelhando
  `app.fonte/features/auth/components/LoginForm.tsx`. Preservar comportamentos atuais:
  - `MustChangePasswordError` → `router.replace("/(auth)/change-password")`;
  - erro genérico → `"WhatsApp/e-mail ou senha incorretos."` via `setError('root', ...)`;
  - aviso `aviso-sessao-expirada` e o `expiredNoticeDismissed` (story 165) continuam funcionando;
  - `onSubmitEditing` no campo de senha submete o formulário;
  - `isSubmitting` substitui o `loading` manual no `ActivityIndicator`.
- `app/(auth)/change-password.tsx`: mesma migração, com o schema reusado da decisão 5. As três
  mensagens de erro atuais (campos vazios, mínimo 6, senhas diferentes) passam a sair do `zod` como
  erro de campo em vez de um `error` único no topo.
- Guardar as `accessibilityLabel` existentes (`input-email`, `input-senha`) nos dois arquivos.

### `app.fonte` — adoção

- `features/auth/LoginForm.tsx`, `features/auth/ChangePasswordForm.tsx`,
  `features/profile/PasswordChangeForm.tsx` — trocar o `TextInput secureTextEntry` dentro do
  `Controller` pelo `PasswordInput`. Já estão em `react-hook-form`; é só substituição de campo.
- Preservar o bloco `__DEV__` de credenciais de teste do `LoginForm` (`fill-test-credentials`),
  usado pelos e2e.

## Validação

Gate: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail` sem justificativa
explícita no código.

Story é frontend-only — sem migration, sem mudança de contrato, sem alteração no
`fonte-api.postman_collection.json`.

- `pnpm test:adm:unit` — novo `src/components/shared/PasswordInput.test.tsx`:
  - renderiza com `type="password"` por padrão;
  - clicar em "Mostrar senha" muda para `type="text"` e o `aria-label` vira "Ocultar senha";
  - segundo clique volta a ocultar;
  - duas instâncias na mesma tela têm estado independente (revelar uma não revela a outra);
  - o valor digitado sobrevive ao toggle.
  - Atualizar `ChangePasswordDialog.test.tsx`, `ResetPasswordDialog.test.tsx` e
    `GenerateAccessDialogs.test.tsx` se os seletores mudarem com a extração — os testes existentes
    dessas telas precisam continuar verdes.
- `pnpm test:adm` (Playwright) — o spec de login exercita o campo de senha; garantir que continua
  passando e cobrir o clique no olho na tela de login.
- `pnpm test:ops:unit` — novo teste do `PasswordInput` RN (mesmos casos acima, via
  `accessibilityLabel` `mostrar-senha`/`ocultar-senha` e a prop `secureTextEntry` do `TextInput`),
  com o stub de `@expo/vector-icons` já usado em `features/activities/components/*.test.tsx`.
  Atualizar `app/(auth)/login.test.tsx` para o formulário migrado, cobrindo:
  - erro de validação por campo vazio vindo do `zod`;
  - credencial inválida → mensagem de erro root;
  - `MustChangePasswordError` → navega para change-password;
  - aviso de sessão expirada (regressão da story 165).
  - Novo teste para `app/(auth)/change-password.tsx`: senha < 6 e senhas diferentes viram erro de
    campo; caso feliz chama `changePassword` e navega.
- `pnpm test:app:unit` — atualizar `features/auth/components/LoginForm.test.tsx` e cobrir o toggle
  nos três formulários tocados.
- `pnpm test:ops` / `pnpm test:app` (Maestro) — rodar os fluxos de login (`e2e/phone-login.yaml`,
  `e2e/helpers/login-operator.yaml`, `login-resident.yaml`, `first-login-set-password.yaml`) para
  confirmar que os `accessibilityLabel` preservados mantêm os fluxos passando.
- E2E web: `apps/ops.fonte/e2e-web/login.spec.ts` e `apps/app.fonte/e2e-web/login.spec.ts` devem
  continuar verdes sem edição — se precisarem de edição, é sinal de que um label mudou e deve ser
  revertido.
- Cobertura: `pnpm test:adm:unit`, `pnpm test:ops:unit` e `pnpm test:app:unit` com cobertura; o
  código novo (os dois `PasswordInput` e os formulários migrados do `ops.fonte`) entra coberto.
- Verificação manual em device/emulador Android (não substitui os testes): digitar senha, tocar no
  olho, confirmar que o texto aparece **e não é perdido**, e que o teclado não fecha.

## Fora de escopo

- Pacote de UI React Native compartilhado entre `ops.fonte` e `app.fonte` — o `PasswordInput` RN
  fica duplicado por app nesta story.
- Medidor de força de senha, regras de complexidade ou mudança do mínimo de 6 caracteres.
- "Esqueci minha senha" / recuperação por WhatsApp.
- Persistir a preferência de senha visível (decisão 6 fecha isso).
- Auto-ocultar a senha depois de N segundos.
- `portal.fonte` (público, sem login) e `resident.fonte` (não scaffoldado).
- Refactor de formulários fora das telas de auth do `ops.fonte`.
