# CLAUDE.md

Guidance de alta prioridade para Claude Code neste repositório. Detalhes sob demanda nas skills `fonte-*` em `.claude/skills/` (carregadas automaticamente quando a tarefa casa).

---

## Projeto

Plataforma operacional da comunidade terapêutica **Fonte de Misericórdia**.

Monorepo pnpm com backend NestJS centralizado e múltiplos frontends.

```
apps/
  adm.fonte/       ← web React/Vite — gestão administrativa
  portal.fonte/    ← web React/Vite — portal público sem login (pagamento de associado, autocancelamento, eventos)
  ops.fonte/       ← Expo/React Native — operadores da casa
  app.fonte/       ← Expo/React Native — familiares (role RELATIVE, ativo)
  resident.fonte/  ← mobile Expo — internos em kiosk (planejado; role RESIDENT já ativa no backend)
services/
  api/             ← backend NestJS
packages/
  api-client/      ← cliente HTTP compartilhado
  types/           ← contratos/tipos compartilhados
  doc-styles/      ← estilos dos documentos gerados (build via `pnpm build:doc-styles`)
```

`portal.fonte` é público e acessado por link tokenizado (WhatsApp), sem autenticação:
`/p/:token` e `/:token` (pagamento), `/cancelar/:token` (autocancelamento de assinatura),
`/eventos` + `/eventos/:id` (eventos públicos), `/pagamento/:token` (inscrição em evento pago).
Segue os mesmos padrões de `adm.fonte` (features/, hooks, react-hook-form + zod, `@fonte/api-client`).

---

## Leia sob demanda

Skills `fonte-*` (em `.claude/skills/`) carregam automaticamente quando a tarefa casa com sua `description`. Existem:

- `fonte-project-map` — onde encontrar cada tipo de mudança no monorepo.
- `fonte-backend` — padrões do backend NestJS, módulos, auth e migrations.
- `fonte-frontend` — padrões dos apps `adm.fonte`, `portal.fonte` e `ops.fonte`.
- `fonte-workflow` — comandos e validação por tipo de mudança.
- `fonte-backup` — runbook de backup banco+bucket.
- `fonte-support-groups` — feature Grupos de Apoio.

Docs canônicos (não são skills):

- `BUSINESS_RULES.md` — regras de negócio e permissões por role.
- `CONTRIBUTING.md` — convenção de commits.
- `docs/lgpd/DIAGNOSTICO_LGPD.md` — inventário de dados pessoais e mapa de gaps LGPD.
- `docs/lgpd/ROADMAP_LGPD.md` — plano faseado de adequação à LGPD.

---

## Disciplina de shell (mantém o auto mode / AUTORUN vivo)

O gateway de permissão do auto mode passa cada comando Bash por um classificador. Comando que ele
não consegue analisar vira pedido de aprovação manual — e trava run autônomo. Regras (valem para o
thread principal **e** para todo agent):

- **NUNCA escrever arquivo pelo shell.** Nada de `cat > arq <<EOF`, `cat >> arq`, `echo ... > arq`,
  `printf`, `tee`, `python - <<'PYEOF'`, `node <<EOF`, `sed -i` multilinha. Use as tools **`Write`**
  (arquivo novo / reescrita) e **`Edit`** (mudança pontual). O hook `bash-guard` bloqueia isso.
- **NUNCA ler `.env` pelo shell** (`cat`/`grep`/`rg`/`head` em `.env`) — o classificador bloqueia
  leitura de segredo. Use a tool `Read`, que nem passa pelo gateway.
- **Ler/buscar código** é `Read`/`Grep`/`Glob`, não `cat`/`grep`/`type` no shell.
- **Um comando simples por chamada Bash.** Regra de allowlist só casa com o comando inteiro:
  `cd X && rtk pnpm test 2>&1 | tail -20` **não** casa e cai no classificador; `pnpm test:api` casa.
  Preferir caminho absoluto a `cd X &&`, evitar cadeias de `&&` e pipes decorativos.
- **Comando > ~1500 chars falha** com `Command exceeds the maximum analyzable length ... requires
  human review`. Payload grande vai para arquivo via `Write` e é referenciado
  (`curl -d @arquivo.json`, `git commit -F arquivo`).
- **NUNCA usar here-string do PowerShell (`@'...'@`) na tool Bash.** A tool Bash é Git Bash
  (POSIX sh) e não entende essa sintaxe: as aspas somem e o `@` fica colado no conteúdo. Em
  `git commit -m @'...'@` o resultado é um commit cujo **título vira `@`**, com a mensagem real
  empurrada para a segunda linha — quebra `git log --oneline`, a exibição no GitHub e qualquer
  ferramenta que leia o subject. Aconteceu em 17 commits antes de ser notado.
  - **Mensagem de commit multilinha:** escrever num arquivo com `Write` e usar
    `git commit -F <arquivo>`. É o caminho que esta seção já prescreve para payload grande, e
    vale aqui mesmo quando a mensagem é curta.
  - Se for mesmo usar a tool **PowerShell** (não a Bash), aí `@'...'@` é válido — mas o `'@` de
    fechamento tem de estar na coluna 0.
- **Código inline** (`node -e`, `python -c`) acima de ~800 chars: escrever script com `Write` e
  executar o arquivo.
- `automode-unavailable` (“classifier temporarily unavailable”) **não é bloqueio** — é indisponibilidade
  transitória. Esperar e repetir até 2x; persistindo, seguir para outra tarefa e voltar depois.

---

## Comandos essenciais

```bash
pnpm install
pnpm docker:up
pnpm dev:api
pnpm dev:adm
pnpm dev:portal
pnpm dev:ops
pnpm build:types
pnpm build:doc-styles
pnpm build:api-client
pnpm build:api
```

Todos os `dev:*` já recompilam dependências compartilhadas. Se alterar `packages/types/src/index.ts`, rode `pnpm build:types` ou reinicie o dev server.

---

## Rodando a aplicação

### Desenvolvimento (produção local)

Requer três terminais:

```bash
# terminal 1 — banco de dados
pnpm docker:up

# terminal 2 — backend
pnpm dev:api          # http://localhost:3000

# terminal 3 — frontend desejado
pnpm dev:adm          # http://localhost:5173
pnpm dev:portal       # http://localhost:5175
pnpm dev:ops          # http://localhost:8082
pnpm dev:app          # Expo (QR code no terminal)
```

### Ambiente de teste

Requer dois terminais:

```bash
# terminal 1 — prepara banco e sobe API em modo test
pnpm test:setup       # docker up + seed de teste
pnpm dev:api:test     # API com NODE_ENV=test

# terminal 2 — frontend em modo test (apenas adm.fonte)
pnpm --filter adm.fonte dev:test   # porta 5174, aponta para API em 3001 (.env.test)
```

---

## Testes

### Referência rápida

| Comando | O que roda |
|---|---|
| `pnpm test:api` | Unit tests do backend (Jest) |
| `pnpm test:api:watch` | Unit tests em modo watch |
| `pnpm test:api:cov` | Unit tests com cobertura |
| `pnpm test:api:e2e` | E2E do backend (Jest + supertest) |
| `pnpm test:adm` | E2E do adm.fonte (Playwright) |
| `pnpm test:portal` | Unit tests do portal.fonte (Vitest) |
| `pnpm test:portal:e2e` | E2E do portal.fonte (Playwright, porta 5176) |
| `pnpm test:ops` | E2E do ops.fonte (Maestro) |
| `pnpm test:app` | E2E do app.fonte (Maestro) |

Cada frontend também tem unit tests: `test:adm:unit`, `test:ops:unit`, `test:app:unit`
(mais `test:api-client`). `pnpm test:cov:all` roda tudo com cobertura.

### Pré-requisitos por tipo

- **`test:api`** — apenas `pnpm docker:up` com DB de teste disponível.
- **`test:api:e2e`** — `pnpm test:setup` + `pnpm dev:api:test` rodando.
- **`test:adm`** — `pnpm test:setup` + `pnpm dev:api:test` + `pnpm dev:adm` rodando na porta 5174.
- **`test:portal` / `test:portal:e2e`** — o unit não precisa de nada; o e2e sobe o próprio Vite na porta 5176 (não reusa o dev), mas precisa de `pnpm test:setup` + `pnpm dev:api:test`.
- **`test:ops` / `test:app`** — Maestro instalado + emulador/dispositivo conectado + API de teste rodando + Metro bundler rodando (`pnpm dev:ops` ou `pnpm dev:app`). No Android, pode ser necessário `adb reverse tcp:8081 tcp:8081` para o emulador alcançar o Metro.
  - **API level máximo 34.** Maestro 2.6.x **não** opera em SDK 36/37 (gRPC `UNAVAILABLE` ou loop de `Failed to record heartbeat`). AVD suportado: `sdkmanager "system-images;android-34;google_apis;x86_64"` + `avdmanager create avd -n Maestro_API34 -k "system-images;android-34;google_apis;x86_64" -d pixel_6`.
  - **APK do `ops.fonte` para e2e:** `pnpm --filter ops.fonte build:e2e:android` (com `--device <serial>` se houver mais de um emulador ligado). O script exige `ANDROID_HOME`, checa o API level, usa a ABI do aparelho e exporta a URL HTTP da API de teste — que é o que libera cleartext no `app.config.js`. Nunca editar o manifest gerado à mão: `android/` é CNG e evapora no próximo prebuild. Sintomas enganosos e causas: skill `fonte-frontend`.

### Suítes e2e são idempotentes (story 182)

As suítes e2e rodam **em qualquer ordem e quantas vezes for preciso** sem reseed: `pnpm test:setup` é
necessário só na **primeira vez** (banco vazio) ou **após mudança de schema**. Não reseede entre
baterias — se precisou, é bug de isolamento da suíte, não do ambiente.

O que sustenta isso, e o que toda suíte nova deve respeitar:

- **Ninguém apaga linha que não criou.** Limpeza é por **id acumulado da fixture**
  (`WHERE id = ANY($1)`), nunca por categoria (`WHERE kind = '...'`) e nunca `DELETE FROM <tabela>`
  seco em tabela que o `seed-test.ts` popula. A catraca `services/api/test/e2e-cleanup-scope.spec.ts`
  (roda em `pnpm test:api`) reprova o padrão antigo.
- **Ninguém deixa o estado do seed mutado.** Teste que grava (pagar parcela, declarar produto, mudar
  status) cria a **própria** fixture via API (`apps/adm.fonte/e2e/helpers/api.ts`) e a remove no
  `afterAll`; o seed é somente leitura. Nome de fixture leva `Date.now()`, e o delete tolera 404.

### Antes de commitar

**SEMPRE** verificar se os testes existentes continuam passando e atualizar os testes afetados pelas mudanças:

1. Se alterou backend: `pnpm test:api` deve passar.
2. Se alterou fluxo coberto por E2E: rodar o teste correspondente e corrigir se quebrou.
3. Se adicionou nova feature com fluxo de usuário: criar ou atualizar o spec/yaml do domínio afetado.
4. Nunca commitar com testes ignorados (`skip`, `only`, `xfail`) sem justificativa explícita no código.

---

## Antes de criar qualquer arquivo

1. **Já existe hook para esse recurso?** Verifique `features/<domínio>/hooks/` antes de criar novo.
2. **Esse componente é reutilizável entre domínios?** Se sim, vai em `components/shared/`; se não, em `features/<domínio>/components/`.
3. **Já existe chamada HTTP equivalente no `@fonte/api-client`?** Não duplique em cada app.
4. **Essa lógica pertence ao service ou ao controller?** Controllers só validam entrada e roteiam.
5. **Já existe migration que cobre essa mudança de schema?** Nunca edite migrations existentes — crie nova.

---

## Nomenclatura

| Tipo | Padrão | Exemplos |
|---|---|---|
| Hook de query | `use<Recurso>` / `use<Recurso>ById` | `useResidents`, `useResidentById` |
| Hook de mutation | `use<Ação><Recurso>` | `useCreateResident`, `useUpdateStaff` |
| Componente de feature | `<Recurso><Papel>` | `ResidentCard`, `IncidentForm` |
| Dialog | `<Ação><Recurso>Dialog` | `AddMinistryDialog`, `EditHouseDialog` |
| Page | `<Recurso>Page` | `ResidentsPage`, `StaffDetailPage` |
| DTO (backend) | `<Ação><Recurso>Dto` | `CreateResidentDto`, `UpdateStaffDto` |

---

## Arquitetura dos frontends

### Estrutura feature-based

```
features/
  <domínio>/
    hooks/       ← useQuery e useMutation encapsulados
    components/  ← componentes de apresentação do domínio
    pages/       ← orquestração; sem lógica de negócio ou fetch direto
    constants.ts ← labels, variantes, configs de exibição
```

### Query keys — padrão mais violado

NUNCA usar string literal como query key fora de `lib/queryKeys.ts`.

```ts
// ✅ correto
useQuery({ queryKey: queryKeys.residents.all, queryFn: ... })

// ❌ proibido
useQuery({ queryKey: ['residents'], queryFn: ... })
```

### Pages não fazem fetch

NUNCA importar `useQuery`, `useMutation` ou `useForm` diretamente em pages.

```ts
// ✅ correto — page orquestra hooks e componentes
export function ResidentsPage() {
  const { data, isLoading } = useResidents();
  return <ResidentList residents={data} isLoading={isLoading} />;
}

// ❌ proibido — fetch direto na page
export function ResidentsPage() {
  const { data } = useQuery({ queryKey: ['residents'], queryFn: api.residents.list });
}
```

### Formulários

SEMPRE usar `react-hook-form` + `zod`. NUNCA `useState` para campos de formulário.

```ts
// ✅ correto
const schema = z.object({ name: z.string().min(1) });
const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

// ❌ proibido
const [name, setName] = useState('');
```

Em React Native, SEMPRE usar `Controller` — `TextInput` não suporta `register`.

### Dialogs autossuficientes

NUNCA fazer prop drilling de dados que só o dialog usa.

```ts
// ✅ correto — dialog busca seus próprios dados
export function AddMinistryDialog({ open, onClose, houseId }: Props) {
  const { data: staff = [] } = useHouseStaff(houseId, { enabled: open });
  const mutation = useAddMinistry(houseId);
}

// ❌ proibido — prop drilling
<AddMinistryDialog staff={staff} residents={residents} availableMinistries={ministries} />
```

### Erros de API

SEMPRE usar `getErrorMessage(error, fallback?)` de `lib/errors.ts`. NUNCA fazer cast manual.

```ts
// ✅ correto
toast.error(getErrorMessage(error, 'Erro ao salvar'));

// ❌ proibido
toast.error((error as any).response?.data?.message ?? 'Erro');
```

### Componentes de estado

SEMPRE usar componentes compartilhados para loading/empty/error.

```ts
// ✅ correto (adm.fonte)
if (isLoading) return <LoadingState />;
if (error) return <ErrorState error={error} />;
if (!data.length) return <EmptyState message="Nenhum resultado" />;

// ❌ proibido
if (isLoading) return <ActivityIndicator />;
if (!data.length) return <Text>Nenhum resultado</Text>;
```

- `adm.fonte`: `LoadingState`, `EmptyState`, `ErrorState` de `@/components/shared/`
- `ops.fonte` / `app.fonte`: criar e adotar componentes equivalentes ao tocar esses apps

### Hooks

Um hook por responsabilidade. Queries e mutations do mesmo recurso no mesmo arquivo. Fetch condicional via `options?: { enabled?: boolean }`.

```ts
// features/houses/hooks/useHouses.ts
export function useHouses() { ... }
export function useHouseById(id: string) { ... }
export function useHouseStaff(houseId: string, options?: { enabled?: boolean }) { ... }
export function useCreateHouse() { ... }
```

### Tamanho e decomposição de componentes

NUNCA deixar componente ultrapassar ~150 linhas. Se passou, quebre.
NUNCA colocar mais de uma responsabilidade visual num componente.
SEMPRE perguntar: "essa parte poderia ser um componente com nome próprio?"

Sinais de que deve quebrar:
- Mais de um bloco condicional de renderização
- Lista com item complexo (extraia o item)
- Seção com título próprio (header, card, row, badge)
- Lógica de exibição que se repetiria em outra tela

Estrutura esperada para page típica:
```
Page          → orquestra layout, sem JSX de detalhe
FeatureCard   → um item da lista
FeatureHeader → cabeçalho da seção
FeatureForm   → formulário isolado
```

NUNCA renderizar `<FlatList>` ou `<Table>` com item inline complexo.
SEMPRE extrair o item como componente separado (ex: `ResidentRow`, `HouseCard`).

---

## `ops.fonte` é offline-first (invariante)

O `ops.fonte` roda **dentro das casas, sem sinal confiável**. Offline-first é requisito permanente
do app, não feature de uma story. Toda mudança nele preserva isso.

- SEMPRE persistir leitura nova consumida em campo (allowlist de query keys em
  `lib/offline/constants.ts` — allowlist por LGPD, nunca virar denylist).
- NUNCA escrever mutation de fluxo de campo (censo, ocorrências, almoxarifado, despensa, venda de
  rua, atividades) com `mutationFn` inline. SEMPRE `mutationKey` + `setMutationDefaults` +
  `networkMode: 'offlineFirst'` — `mutationFn` inline não é serializável e o lançamento feito sem
  sinal se perde no restart.
- NUNCA descartar item de fila em silêncio: rejeição do servidor vai para a tela de pendências
  (`/sync`) com o erro; erro de rede não é falha, o item continua na fila.
- NUNCA tratar erro de rede como sessão expirada (401 só dispara logout em 401 real).
- Fluxo que exige rede (mensagens, wishlist, grupos de apoio, curso bíblico) desabilita a ação com
  aviso — nada de erro genérico de axios na tela.
- Teste de offline vai no Playwright web (`e2e-web/`, `context.setOffline`); Maestro não controla
  rede.

Detalhes na skill `fonte-frontend`. Desenho e estado da infra: `stories/167-ops-offline-first-epic.md`
(filhas 168–171) — se `apps/ops.fonte/lib/offline/` ainda não existir, a infra é a story 168; não
improvise solução paralela.

---

## Regras arquiteturais — backend

- NUNCA acessar banco fora da camada de persistência do módulo (repository/entity).
- NUNCA colocar regra de negócio no controller — só validação de entrada e roteamento.
- SEMPRE validar entradas externas com DTO + `class-validator`.
- NUNCA editar migrations existentes para mudar comportamento; crie nova migration.
- Banco PostgreSQL: snake_case, UUID v4, soft delete via `deleted_at`.
- Services dependem de outros módulos apenas via interface/contrato claro.
- SEMPRE atualizar `fonte-api.postman_collection.json` na raiz ao adicionar, remover ou alterar qualquer endpoint (rota, método, body, params, response). A coleção é a documentação viva da API.

---

## Regras de negócio críticas

Consulte `BUSINESS_RULES.md` antes de tocar nestes fluxos:

- Resident deve ter pelo menos um Relative no acolhimento manual (import em lote dispensa); `house_id` é obrigatório exceto para status `ARCHIVED` (filho sem casa fica fora das listagens/contagens por casa).
- Staff deve ter `house_id`.
- Status de Resident só muda por transição validada em service.
- RoutineEntry não pode ser editada após 24h.
- Incident não pode ser deletado.
- Alta exige status `ACTIVE` ou `DISCIPLINE` + `exit_date`.
- Storeroom não tem estorno; correções são feitas por novo lançamento.
- `resident.fonte`: limite de 25 min/dia por interno, controlado pelo backend.

---

## Identidade e auth

- Autenticação centralizada em `User`.
- `Staff.user_id` é obrigatório; `Relative.user_id` e `Resident.user_id` são preenchidos quando recebem acesso.
- Roles `ADMIN`, `COORDINATOR`, `SERVANT` são exclusivas de Staff.
- Role `RELATIVE` (familiares) está ativa e em uso pelo `app.fonte`.
- Role `RESIDENT` (internos) está ativa no backend (login, mensagens, sessão de uso com limite diário); o app/kiosk dedicado (`resident.fonte`) ainda não foi scaffoldado.
- JWT carrega `user_id`, `role`, `profile_type` (`STAFF` | `RELATIVE` | `RESIDENT`).

---

## Observabilidade (Sentry — story 43)

Sentry SaaS, **1 projeto/DSN por app** (`fonte-api`, `fonte-adm`, `fonte-associados` ← `portal.fonte`,
`fonte-ops`, `fonte-app`). Cobre errors, tracing, profiling e logs estruturados.

- **DSN sempre via env.** Sem DSN o SDK fica inerte — dev local e testes não disparam eventos.
  - api: `SENTRY_DSN` (+ `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`).
  - adm/portal: `VITE_SENTRY_DSN` (+ `VITE_SENTRY_*_SAMPLE_RATE`).
  - ops/app: `EXPO_PUBLIC_SENTRY_DSN` (+ `EXPO_PUBLIC_SENTRY_*_SAMPLE_RATE`).
- **Init**: api em `src/instrument.ts` (importado 1ª linha do `main.ts`); web em
  `src/lib/sentry.ts` (chamado no `main.tsx`); RN em `lib/sentry.ts` (chamado no `app/_layout.tsx`,
  export envolvido em `Sentry.wrap`).
- **Source maps** (prod): upload via `@sentry/vite-plugin` (web) / config plugin EAS (RN), só com
  `SENTRY_AUTH_TOKEN` no build/CI. Nunca commitar o token.
- "Metrics" como produto foi descontinuado pelo Sentry — métricas vêm de tracing/spans.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->