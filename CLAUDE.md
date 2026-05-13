# CLAUDE.md

This file provides high-signal guidance for Claude Code when working in this repository. Keep it short: detailed context lives in `docs/ai/` and should be opened only when relevant.

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

Abra apenas os guias necessários para a tarefa atual para não sobrecarregar contexto.

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
pnpm test:api
```

`pnpm dev:api`, `pnpm dev:adm` e `pnpm dev:ops` já recompilam dependências compartilhadas necessárias. Se alterar `packages/types/src/index.ts`, rode `pnpm build:types` ou reinicie o dev server.

---

## Arquitetura dos frontends (adm.fonte e ops.fonte)

### Estrutura feature-based

Cada domínio vive em `src/features/<domínio>/` com subpastas fixas:

```
features/
  <domínio>/
    hooks/       ← useQuery e useMutation encapsulados
    components/  ← componentes de apresentação reutilizáveis
    pages/       ← orquestração; sem lógica de negócio ou fetch direto
    constants.ts ← labels, variantes, configs de exibição
```

Páginas só importam hooks e componentes — nunca `useQuery`/`useMutation` diretamente.

### Query keys

Todas as query keys ficam em `src/lib/queryKeys.ts` (adm) ou `lib/queryKeys.ts` (ops). Nunca usar strings literais como `['residents']` fora deste arquivo.

```ts
// correto
useQuery({ queryKey: queryKeys.residents.all, ... })

// proibido
useQuery({ queryKey: ['residents'], ... })
```

### Hooks

Um hook por responsabilidade. Queries e mutations do mesmo recurso ficam no mesmo arquivo.

```ts
// features/houses/hooks/useHouses.ts
export function useHouses() { ... }
export function useHouseById(id) { ... }
export function useHouseStaff(houseId, options?) { ... }   // options.enabled para lazy fetch
export function useCreateHouse() { ... }
```

Hooks que precisam de fetch condicional aceitam `options?: { enabled?: boolean }` — padrão `true`.

### Formulários

Todos os formulários usam `react-hook-form` + `zod`. Nunca `useState` manual para campos de form.

```ts
const schema = z.object({ name: z.string().min(1) });
const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm({
  resolver: zodResolver(schema),
});
```

Em React Native usar `Controller` para todos os inputs (TextInput não suporta `register`).

### Erros de API

Usar `getErrorMessage(error, fallback?)` de `src/lib/errors.ts` (adm) / `lib/errors.ts` (ops). Nunca fazer cast manual de `error` para extrair mensagem.

### Dialogs e modais

Cada dialog é um componente separado que:

- Recebe só o mínimo necessário para se identificar (`open`/`target`, `onClose`, `houseId` etc.)
- Busca seus próprios dados internamente via hooks, com `enabled` atrelado ao estado de abertura
- Gerencia seu próprio estado de formulário
- Chama sua própria mutation

```ts
// correto — dialog autossuficiente
export function AddMinistryDialog({ open, onClose, houseId }: Props) {
  const { data: staff = [] } = useHouseStaff(houseId, { enabled: open });
  const mutation = useAddMinistry(houseId);
  ...
}

// evitar — prop drilling de dados que só o dialog usa
<AddMinistryDialog staff={staff} residents={residents} availableMinistries={...} />
```

### Componentes

Componentes devem ter responsabilidade unica.

### Componentes de estado

Sempre usar os componentes compartilhados — nunca `ActivityIndicator` ou texto inline para loading/empty/error:

- `adm.fonte`: `LoadingState`, `EmptyState`, `ErrorState` de `@/components/shared/`
- `ops.fonte`: ainda inline (componentes compartilhados pendentes)

---

## Regras arquiteturais obrigatórias

- Nenhum acesso ao banco fora da camada/padrão de persistência do módulo.
- Nenhuma regra de negócio no controller.
- Services não devem depender diretamente de outros módulos sem interface/contrato claro.
- DTO obrigatório para entrada/saída externa, validado com `class-validator`.
- Banco PostgreSQL único, snake_case, UUID v4, soft delete via `deleted_at`.
- Não editar migrations antigas para mudar comportamento; criar nova migration.

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
