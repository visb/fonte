# CLAUDE.md

Guidance de alta prioridade para Claude Code neste repositório. Detalhes sob demanda nas skills `fonte-*` em `.claude/skills/` (carregadas automaticamente quando a tarefa casa).

---

## Projeto

Plataforma operacional da comunidade terapêutica **Fonte de Misericórdia**.

Monorepo pnpm com backend NestJS centralizado e múltiplos frontends.

```
apps/
  adm.fonte/       ← web React/Vite — gestão administrativa
  ops.fonte/       ← Expo/React Native — operadores da casa
  app.fonte/       ← Expo/React Native — familiares (role RELATIVE, ativo)
  resident.fonte/  ← mobile Expo — internos em kiosk (planejado; role RESIDENT já ativa no backend)
services/
  api/             ← backend NestJS
packages/
  api-client/      ← cliente HTTP compartilhado
  types/           ← contratos/tipos compartilhados
```

---

## Leia sob demanda

Skills `fonte-*` (em `.claude/skills/`) carregam automaticamente quando a tarefa casa com sua `description`. Existem:

- `fonte-project-map` — onde encontrar cada tipo de mudança no monorepo.
- `fonte-backend` — padrões do backend NestJS, módulos, auth e migrations.
- `fonte-frontend` — padrões dos apps `adm.fonte` e `ops.fonte`.
- `fonte-workflow` — comandos e validação por tipo de mudança.
- `fonte-backup` — runbook de backup banco+bucket.
- `fonte-support-groups` — feature Grupos de Apoio.

Docs canônicos (não são skills):

- `BUSINESS_RULES.md` — regras de negócio e permissões por role.
- `CONTRIBUTING.md` — convenção de commits.
- `docs/lgpd/DIAGNOSTICO_LGPD.md` — inventário de dados pessoais e mapa de gaps LGPD.
- `docs/lgpd/ROADMAP_LGPD.md` — plano faseado de adequação à LGPD.

---

## Comandos essenciais

```bash
pnpm install
pnpm docker:up
pnpm dev:api
pnpm dev:adm
pnpm dev:ops
pnpm build:types
pnpm build:api-client
pnpm build:api
```

`pnpm dev:api`, `pnpm dev:adm` e `pnpm dev:ops` já recompilam dependências compartilhadas. Se alterar `packages/types/src/index.ts`, rode `pnpm build:types` ou reinicie o dev server.

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
| `pnpm test:ops` | E2E do ops.fonte (Maestro) |
| `pnpm test:app` | E2E do app.fonte (Maestro) |

### Pré-requisitos por tipo

- **`test:api`** — apenas `pnpm docker:up` com DB de teste disponível.
- **`test:api:e2e`** — `pnpm test:setup` + `pnpm dev:api:test` rodando.
- **`test:adm`** — `pnpm test:setup` + `pnpm dev:api:test` + `pnpm dev:adm` rodando na porta 5174.
- **`test:ops` / `test:app`** — Maestro instalado + emulador/dispositivo conectado + API de teste rodando + Metro bundler rodando (`pnpm dev:ops` ou `pnpm dev:app`). No Android, pode ser necessário `adb reverse tcp:8081 tcp:8081` para o emulador alcançar o Metro.

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

Sentry SaaS, **1 projeto/DSN por app** (`fonte-api`, `fonte-adm`, `fonte-associados`,
`fonte-ops`, `fonte-app`). Cobre errors, tracing, profiling e logs estruturados.

- **DSN sempre via env.** Sem DSN o SDK fica inerte — dev local e testes não disparam eventos.
  - api: `SENTRY_DSN` (+ `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`).
  - adm/associados: `VITE_SENTRY_DSN` (+ `VITE_SENTRY_*_SAMPLE_RATE`).
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