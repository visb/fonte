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
  ff.fonte/        ← mobile Expo — familiares (fase 2)
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
