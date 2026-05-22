Leia o CLAUDE.md, docs/ai/project-map.md e docs/ai/frontend-guide.md.
Leia também os testes E2E já criados em apps/adm.fonte/e2e/ e
apps/ops.fonte/e2e/ para entender o padrão adotado no projeto.

Vamos criar testes E2E para o app.fonte usando Maestro, e em seguida
executar o review e refactor do app.

## Parte 1 — Ambiente de testes

### Verifique o seed de testes

Abra services/api/src/database/seed-test.ts e verifique se contém:

- 1 familiar vinculado ao residente com:
  - userId preenchido
  - mustChangePassword: false
  - email: familiar@fonte.com
  - senha: familiar123
- O residente vinculado ao familiar deve ter:
  - casa associada com nome, endereço e telefone preenchidos
  - pelo menos 1 item aprovado na wishlist
- Pelo menos 1 mensagem aprovada na thread do familiar com o residente
- Pelo menos 1 grupo de apoio com uma reunião criada (para o flow de checkin)

Se algum dado estiver faltando, adicione ao seed-test.ts antes de continuar.

### Verifique o ambiente

Confirme que a API de testes está acessível:
curl http://localhost:3001/api/v1/auth/login \
 -X POST -H "Content-Type: application/json" \
 -d '{"email":"familiar@fonte.com","password":"familiar123"}'

Se não estiver rodando, execute:
NODE_ENV=test pnpm --filter api migration:run
pnpm seed:test
NODE_ENV=test pnpm --filter api start:test &

### Verifique o emulador

Confirme que há um emulador/device ativo:
maestro device

Se não houver device, PARE e reporte.

### Configure o app para apontar para a API de testes

Verifique se apps/app.fonte tem mecanismo para apontar
EXPO_PUBLIC_API_URL para http://localhost:3001/api/v1.
Se não tiver, crie apps/app.fonte/.env.test com:
EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1

Suba o app no emulador apontando para a API de testes:
cd apps/app.fonte && EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1 npx expo run:ios

Aguarde o app estar instalado e rodando antes de continuar.

## Parte 2 — Criação dos testes Maestro

Crie os arquivos em apps/app.fonte/e2e/

### Helper reutilizável

Crie e2e/helpers/login.yaml:

- launchApp
- tapOn: campo de email → preenche familiar@fonte.com
- tapOn: campo de senha → preenche familiar123
- tapOn: botão Entrar
- assertVisible: texto que confirma tela Início carregada

### Flows por domínio

e2e/auth.yaml
→ login com credenciais válidas
→ assertVisible: nome do familiar na tela Início
→ login com credenciais inválidas
→ assertVisible: mensagem de erro
→ login válido → logout via botão na tela Início
→ assertVisible: tela de login

e2e/home.yaml
→ runFlow: e2e/helpers/login.yaml
→ assertVisible: nome do familiar
→ assertVisible: nome do acolhido
→ assertVisible: nome da casa
→ assertVisible: endereço da casa
→ assertVisible: seção Informações da Casa

e2e/messages.yaml
→ runFlow: e2e/helpers/login.yaml
→ navegar para aba Mensagens
→ assertVisible: nome do acolhido na lista de conversas
→ tocar na conversa do acolhido
→ assertVisible: mensagem aprovada do seed
→ digitar mensagem de texto
→ tocar em enviar
→ assertVisible: mensagem enviada com status aguardando aprovação

e2e/messages-staff.yaml
→ runFlow: e2e/helpers/login.yaml
→ navegar para aba Mensagens
→ assertVisible: seção de conversas com servos (se existir)
→ se existir servo com permissão SEND_MESSAGES_TO_FAMILIES no seed:
→ tocar na conversa com o servo
→ assertVisible: tela de thread direta
→ digitar mensagem
→ enviar
→ assertVisible: mensagem na thread

e2e/wishlist.yaml
→ runFlow: e2e/helpers/login.yaml
→ navegar para aba Pedidos
→ assertVisible: item aprovado do seed na lista
→ assertVisible: descrição do item

e2e/checkin.yaml
→ runFlow: e2e/helpers/login.yaml
→ navegar para aba Check-in
→ assertVisible: tela de câmera ou solicitação de permissão
→ se permissão solicitada: assertVisible: botão para permitir câmera

e2e/profile.yaml
→ runFlow: e2e/helpers/login.yaml
→ navegar para aba Perfil
→ assertVisible: nome do familiar
→ assertVisible: campo de nome editável
→ assertVisible: seção Alterar senha
→ editar nome para um valor diferente
→ tocar em Salvar dados
→ assertVisible: confirmação de sucesso

## Parte 3 — Validação dos testes

Rode todos os flows:
maestro test apps/app.fonte/e2e/ \
 --env API_URL=http://localhost:3001/api/v1

Todos os flows devem passar antes de continuar para o refactor.
Se algum falhar por timing, ajuste com waitForAnimationToEnd onde necessário.
Corrija e re-rode até todos estarem verdes — não avance com testes falhando.

## Parte 4 — Review e refactor do app.fonte

Com os testes passando, execute o review de todos os domínios em sequência,
sem parar para pedir confirmação entre eles.

Para cada domínio: analise, refatore, valide e commite antes de passar
para o próximo. Só pare e consulte o usuário nos casos listados em
"Pare e me consulte se" abaixo.

### Ordem dos domínios

1. checkin
2. wishlist
3. home
4. messages
5. profile
6. auth

### Para cada domínio:

**Passo 1 — Análise**
Leia todos os arquivos do domínio em apps/app.fonte/features/<domínio>/
Identifique internamente os problemas:

- Componentes acima de 150 linhas
- Lógica inline em pages que deveria estar em hooks
- ActivityIndicator ou texto inline no lugar de componentes em
  components/shared/ (LoadingState, EmptyState, ErrorState)
- Itens de lista renderizados inline sem componente próprio
- Estado de formulário com useState manual em vez de react-hook-form + Controller
- Em React Native: inputs sem Controller do react-hook-form

Não mostre a lista nem aguarde confirmação — prossiga direto para o refactor.

**Passo 2 — Refactor**
Refatore um arquivo por vez seguindo o CLAUDE.md.
Atenção especial para app.fonte:

- O app usa NativeWind com tema violeta (#7c3aed) — preserve as cores
- Componentes de estado em components/shared/ já existem neste app —
  use LoadingState, EmptyState e ErrorState existentes antes de criar novos
- Em React Native todos os inputs usam Controller, nunca register direto
- O AuthContext expõe relative e isLoading — não altere a interface
- lib/auth.tsx não deve ser tocado

**Passo 3 — Validação**
Após cada arquivo:

1. Verifique TypeScript: pnpm build:types && pnpm build:api-client
2. Rode os testes Maestro: maestro test apps/app.fonte/e2e/
3. Se algum teste quebrar, corrija antes de continuar para o próximo arquivo.

**Passo 4 — Commit**
git add apps/app.fonte/features/<domínio>/
git commit -m "refactor(apps/app): refatora domínio <nome>"

Após o commit, passe imediatamente para o próximo domínio.

## Regras inegociáveis

- NUNCA altere lib/auth.tsx ou lib/api.ts sem avisar explicitamente.
- NUNCA altere lib/queryKeys.ts sem avisar explicitamente.
- NUNCA refatore mais de um domínio por vez.
- NUNCA faça commit sem todos os testes Maestro passando.
- Se um arquivo tiver mais de 300 linhas, pare e me consulte.

## Pare e me consulte se (e somente se):

- Uma mudança afetar o fluxo de autenticação do familiar
- Um componente precisar ser movido para components/shared/
- Não estiver claro como quebrar um componente sem alterar comportamento
- Mais de 2 testes falharem após uma mudança
- O build falhar por mais de 2 tentativas de correção

## Entregável final

Ao concluir todos os domínios, mostre um resumo com:

- Domínios refatorados
- Total de componentes criados
- Total de arquivos alterados
- Status final dos testes Maestro
