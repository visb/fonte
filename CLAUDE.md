# CLAUDE.md

Guidance de alta prioridade para Claude Code neste repositório. Detalhes completos em `docs/ai/`.

---

## Projeto

Plataforma operacional da comunidade terapêutica **Fonte de Misericórdia**.

Monorepo pnpm com backend NestJS centralizado e múltiplos frontends.

```
apps/
  adm.fonte/       ← web React/Vite — gestão administrativa
  ops.fonte/       ← Expo/React Native — operadores da casa
  app.fonte/       ← Expo/React Native — familiares (role RELATIVE)
  resident.fonte/  ← mobile Expo — internos em kiosk (fase 2)
services/
  api/             ← backend NestJS
packages/
  api-client/      ← cliente HTTP compartilhado
  types/           ← contratos/tipos compartilhados
```

---

## Leia sob demanda

- `docs/ai/project-map.md` — onde encontrar cada tipo de mudança.
- `docs/ai/backend-guide.md` — padrões do backend, módulos, auth e migrations.
- `docs/ai/frontend-guide.md` — padrões dos apps `adm.fonte` e `ops.fonte`.
- `docs/ai/workflow-guide.md` — comandos e validação por tipo de mudança.
- `BUSINESS_RULES.md` — regras de negócio e permissões por role.
- `CONTRIBUTING.md` — convenção de commits.

Abra apenas os guias necessários para a tarefa atual.

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
pnpm dev:adm          # em outro terminal, com a flag de env de teste
# adm.fonte aponta para http://localhost:5174 em modo test
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

---

## Regras de negócio críticas

Consulte `BUSINESS_RULES.md` antes de tocar nestes fluxos:

- Resident deve ter `house_id` e pelo menos um Relative cadastrado.
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
- Roles `ADMIN`, `COORDINATOR`, `OPERATOR` são exclusivas de Staff.
- Roles `RELATIVE`, `RESIDENT` são fases futuras.
- JWT carrega `user_id`, `role`, `profile_type` (`STAFF` | `RELATIVE` | `RESIDENT`).
