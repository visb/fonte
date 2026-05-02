# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Projeto

Plataforma operacional da comunidade terapêutica **Fonte de Misericórdia**.

Monorepo com backend NestJS centralizado e múltiplos frontends (web/mobile).

```
apps/
  adm.fonte/       ← web (React) — gestão administrativa
  ops.fonte/       ← mobile (Expo) — operadores da casa
  ff.fonte/        ← mobile (Expo) — familiares (fase 2)
  resident.fonte/  ← mobile (Expo) — internos em modo kiosk (fase 2)

services/
  api/             ← backend NestJS

packages/
  shared/
  ui/
  types/
```

---

## Stack

- **Backend**: NestJS + PostgreSQL + JWT
- **Web**: React
- **Mobile**: React Native (Expo)
- **Banco**: PostgreSQL único, snake_case, UUID v4, soft delete via `deleted_at`

---

## Arquitetura do Backend (`services/api`)

Organizado por módulos de domínio em `src/modules/`. Cada módulo contém: `controller`, `service`, `repository`, `dto`, `entity`.

**Módulos:**
- `auth` — JWT, login, guard por role
- `user` — identidade centralizada (credenciais, role, is_active)
- `house` — unidades físicas da comunidade
- `staff` — colaboradores internos; sempre tem `user_id`
- `resident` — internos; `user_id` nullable (preenchido ao liberar acesso kiosk)
- `relative` — familiares; `user_id` nullable (preenchido ao liberar portal)
- `routine` — registros operacionais diários
- `incident` — ocorrências disciplinares/médicas
- `ministry` — setores funcionais
- `storeroom` — dispensa por casa

**Regras arquiteturais:**
- Nenhum acesso ao banco fora do `repository`
- Nenhuma regra de negócio no `controller`
- `Services` não dependem de outros módulos diretamente sem interface
- DTO obrigatório para entrada/saída, validado com `class-validator`

---

## Modelo de Identidade (User + Perfis)

Autenticação centralizada em `User`. As entidades de domínio guardam a FK:

| Entidade | `user_id`  | Quando é preenchido                         |
| -------- | ---------- | ------------------------------------------- |
| Staff    | sempre     | No cadastro do colaborador                  |
| Relative | nullable   | Quando o familiar receber acesso ao portal  |
| Resident | nullable   | Quando o interno receber acesso ao kiosk    |

Roles: `ADMIN`, `COORDINATOR`, `OPERATOR` → exclusivos de Staff. `RELATIVE`, `RESIDENT` → fases futuras.

Token JWT carrega: `user_id`, `role`, `profile_type` (STAFF | RELATIVE | RESIDENT).

---

## Status do Interno (Resident)

`PRE_ADMISSION` → `ACTIVE` ↔ `DISCIPLINE` ↔ `TEMP_LEAVE` → `DISCHARGED` / `EVADED`

Transições controladas via service. Nunca alterar `status` diretamente sem validação.

---

## Regras de Negócio Críticas

- Resident deve ter `house_id` e pelo menos um Relative cadastrado
- Staff deve ter `house_id`
- RoutineEntry não pode ser editada após 24h
- Incident não pode ser deletado
- Alta exige `status` ACTIVE ou DISCIPLINE + registro de `exit_date`
- Storeroom: sem estorno — correções via novo lançamento
- resident.fonte: limite de 25 min/dia por interno, controlado pelo backend

Consulte `BUSINESS_RULES.md` para a tabela completa de permissões por role.
