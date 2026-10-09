# AGENTS.md

Guidance de alta prioridade para agentes (Codex) neste repositório. Detalhes sob demanda nas skills
em `.agents/skills/` (carregadas quando a tarefa casa com a `description`, ou invocadas com
`$<nome>`).

> Portado de `CLAUDE.md` + `.claude/` em 2026-09-26. Stories antigas que citam `CLAUDE.md`,
> `.claude/skills/*`, tools `Write`/`Edit`/`Read`/`Agent` ou `/loop` → ler como `AGENTS.md`,
> `.agents/skills/*`, `apply_patch`/leitura de arquivo, subagentes `.codex/agents/*` e execução
> sequencial na sessão. `/issue`, `/planning`, `/autorun` → `$issue`, `$planning`, `$autorun`.

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

Skills (em `.agents/skills/`) — carregue a da área **antes** de mexer nela:

- `fonte-project-map` — onde encontrar cada tipo de mudança no monorepo.
- `fonte-backend` — padrões do backend NestJS, módulos, auth e migrations.
- `fonte-frontend` — padrões dos apps `adm.fonte`, `portal.fonte` e `ops.fonte`.
- `fonte-workflow` — comandos e validação por tipo de mudança.
- `fonte-backup` — runbook de backup banco+bucket.
- `fonte-support-groups` — feature Grupos de Apoio.
- `issue` (`$issue`) — cria uma story em `stories/NN-slug.md` e commita na main. Não implementa.
- `planning` (`$planning`) — sprint planning sobre `stories/BACKLOG.md`, uma story por item.
- `autorun` (`$autorun`) — run autônomo de stories segundo `stories/AUTORUN.md`.

Subagentes (em `.codex/agents/`):

- `fonte-implementer` — implementa UMA story de ponta a ponta numa branch (sem push/merge).
- `fonte-validator` — roda os gates e devolve PASS/FAIL (read-only, não corrige).

Memória do projeto (local, gitignored): `.codex/memory/MEMORY.md` é o índice; leia os arquivos
relevantes antes de tarefas de build Android, deploy/VPS, backup, produção, LGPD ou import de filhos.
Ao aprender algo durável e não-óbvio, registre lá (um fato por arquivo + linha no índice).

Docs canônicos (não são skills):

- `BUSINESS_RULES.md` — regras de negócio e permissões por role.
- `CONTRIBUTING.md` — convenção de commits.
- `docs/lgpd/DIAGNOSTICO_LGPD.md` — inventário de dados pessoais e mapa de gaps LGPD.
- `docs/lgpd/ROADMAP_LGPD.md` — plano faseado de adequação à LGPD.

---

## Disciplina de shell

Ambiente: **Windows**, shell padrão PowerShell. Regras (valem para a thread principal **e** para
todo subagente):

- **Arquivo se escreve com `apply_patch`**, não pelo shell. Nada de `cat > arq <<EOF`, `echo ... >
  arq`, `Set-Content`/`Out-File` com corpo grande, `python - <<'PYEOF'`, `node <<EOF`, `sed -i`
  multilinha — é frágil com encoding/CRLF no Windows e esconde o diff.
- **NUNCA imprimir `.env` no terminal** (nem `cat`/`Get-Content`/`rg` que ecoe valor). Se precisar de
  uma chave, verificar existência/host sem mostrar o segredo.
- **Buscar código:** `rg` / `rg --files`.
- **Um comando simples por chamada.** Evitar cadeias longas de `&&` e pipes decorativos; comandos
  curtos casam com a allowlist em `.codex/rules/fonte.rules` e não pedem aprovação.
- **Mensagem de commit multilinha:** escrever num arquivo e usar `git commit -F <arquivo>`.
  - No PowerShell, here-string `@'...'@` é válido, mas o `'@` de fechamento tem de estar na coluna 0.
  - **Nunca** usar `@'...'@` num shell POSIX (Git Bash): o `@` gruda no conteúdo e o **título do
    commit vira `@`** — aconteceu em 17 commits antes de ser notado.
- **Código inline** (`node -e`, `python -c`) acima de ~800 chars: escrever script em arquivo e executar.
- **Nunca `robocopy /MIR` nem delete recursivo agressivo em `node_modules`**: com `nodeLinker:
  hoisted`, entradas de workspace são links para o fonte e o delete apaga `apps/*`/`packages/*`.

## Produção — cuidado

- `services/api/.env` local já apontou `DATABASE_URL` para **produção**. Antes de `pnpm dev:api` ou
  script de escrita, conferir o host do `DATABASE_URL` (sem imprimir credencial).
- Backfill em produção: dry-run primeiro, transação, guardar IDs inseridos para rollback.
- Produção roda num VPS (Docker Compose, Postgres 18) — detalhes em `.codex/memory/project_vps_*.md`.

## Nomes

Todo identificador de código em **inglês** (variável, função, componente, hook, tipo, DTO).
Português só em strings exibidas ao usuário.

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

---

## RTK (Rust Token Killer)

Prefixar comandos com `rtk` quando útil para comprimir saída (passa direto se não houver filtro):
`rtk git status|diff|log`, `rtk pnpm ...`, `rtk jest`, `rtk vitest`, `rtk playwright test`,
`rtk tsc`, `rtk lint`, `rtk docker ps|logs`, `rtk gh pr view`. `rtk err <cmd>` filtra só erros;
`rtk proxy <cmd>` roda sem filtro (debug). Ao depurar falha, preferir saída crua.

