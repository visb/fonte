# Arquitetura – Fonte de Misericórdia

## 1. Estratégia

Aplicação centralizada, backend único, organizada por módulos de domínio.

Objetivo:
Clareza estrutural sem complexidade desnecessária.

---

## 2. Backend Structure (NestJS)

src/
  modules/
    auth/
    user/
    house/
    resident/
    relative/
    routine/
    incident/
    staff/
    ministry/
    storeroom/
  common/
  config/

Cada módulo contém:
- controller
- service
- repository
- dto
- entity

---

## 3. Banco de Dados

PostgreSQL único.

Padrões:
- UUID v4
- snake_case nas tabelas
- timestamps padrão (created_at, updated_at)
- deleted_at para soft delete

---

## 4. Domínios Principais

### User
Entidade central de autenticação e identidade.
Centraliza credenciais, role e status de acesso.
Não carrega dados de domínio — apenas autentica.

Campos principais:
- id (uuid)
- email
- password_hash
- role (ADMIN | COORDINATOR | OPERATOR | RELATIVE | RESIDENT)
- is_active
- created_at / updated_at / deleted_at

### House
Unidade física da comunidade.

### Resident
Representa o interno e sua jornada institucional.
Possui `user_id` nullable — preenchido quando o interno ganha acesso ao app kiosk.

### Relative
Familiares/responsáveis associados ao interno.
Possui `user_id` nullable — preenchido quando o familiar ganha acesso ao portal.

### RoutineEntry
Registros operacionais diários.

### Incident
Ocorrências disciplinares ou médicas.

### Staff
Colaboradores internos com acesso operacional ao sistema.
Possui `user_id` — sempre preenchido (Staff sem acesso ao sistema não existe).

### Ministry
Setores funcionais da comunidade.
Cada ministério possui responsáveis e filhos designados.

### Storeroom
Dispensa individual de cada casa.
Controla entradas, saídas e conferências de itens.
Logs de movimentação registrados no próprio serviço.

---

## 5. Autenticação

- JWT
- Login via entidade `User`; o token carrega `user_id`, `role` e `profile_type` (STAFF | RELATIVE | RESIDENT)
- Na v1: apenas Staff possui `user_id` (roles: ADMIN, COORDINATOR, OPERATOR)
- Futuro: Relative e Resident ganham `user_id` quando receberem acesso ao portal/kiosk
- Guard por Role
- Middleware global de validação

---

## 6. Regras Arquiteturais

- Nenhum acesso direto ao banco fora do repository
- Nenhuma regra de negócio em controller
- DTO validado com class-validator
- Services não dependem de outros módulos diretamente sem interface

---

## 7. Escalabilidade Futura

Arquitetura preparada para futura extração de domínios como:

- notifications
- reporting
- portal de familiares

Sem implementação neste momento.