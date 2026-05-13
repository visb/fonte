# Guia do backend para IA

## Estrutura

Backend em NestJS dentro de `services/api`.

Arquivos de entrada:

- `src/main.ts` — bootstrap da API e prefixo global.
- `src/app.module.ts` — composição dos módulos e guards globais.
- `src/config/*` — configuração de banco/JWT.
- `src/database/*` — data source, seed e migrations TypeORM.
- `src/common/*` — guards e decorators compartilhados.
- `src/modules/<domínio>/*` — controller, service, DTOs e entities por domínio.

Módulos atuais em `src/app.module.ts`:

- `auth`, `user`, `house`, `staff`, `resident`, `relative`, `incident`, `ministry`, `storeroom`, `document-template`, `storage`, `support-group`, `resident-session`, `message`, `wishlist`.

## Padrão de módulo

Ao alterar ou criar funcionalidade de domínio:

1. Leia o módulo existente mais próximo em `services/api/src/modules`.
2. Mantenha controllers finos: validação/roteamento no controller, regra de negócio no service.
3. Use DTOs com `class-validator` para entradas externas.
4. Use entities TypeORM para persistência.
5. Consulte `BUSINESS_RULES.md` antes de mudar status, permissões, exclusão, rotina, ocorrência ou storeroom.

Observação: `CLAUDE.md` define a regra arquitetural de não acessar banco fora de repository. Antes de adicionar novo acesso ao banco, verifique o padrão atual do módulo afetado e preserve a separação mais explícita disponível.

## Autenticação e autorização

- Autenticação é centralizada em `User`.
- Token JWT carrega `user_id`, `role` e `profile_type`.
- Guards/decorators compartilhados ficam em `src/common`.
- `MustChangePasswordGuard` é global em `src/app.module.ts`.
- Para rotas novas, verifique roles em `BUSINESS_RULES.md` e use os decorators/guards existentes.

## Banco e migrations

- Banco PostgreSQL único.
- Convenções: snake_case, UUID v4, soft delete via `deleted_at`.
- Migrations ficam em `services/api/src/database/migrations`.
- Não edite migrations antigas já existentes para mudar comportamento; crie uma nova migration.
- Execute migrations com os scripts do package `api` ou com `pnpm --filter api`.

## Resident — acesso e módulos

- `Resident.userId` é nullable; preenchido quando ADMIN/COORDINATOR gera acesso via `POST /residents/:id/access`.
- O JWT de resident carrega `role: RESIDENT` e `profileType: RESIDENT`.
- Módulo `resident-session`: rastreia uso diário do resident em segundos (`resident_usage_sessions`). Heartbeat via `POST /resident-sessions/heartbeat` é atômico (upsert SQL com `LEAST`) e retorna o total atualizado — suporta múltiplos devices simultâneos sem race condition.
- Módulo `message`: mensagens resident↔familiar com fluxo de moderação. Mensagens de resident nascem como `PENDING_APPROVAL`; servant aprova/rejeita.
- Módulo `wishlist`: lista de pedidos para visita. Itens criados por resident nascem como `PENDING_APPROVAL`. Rejeição suporta motivo opcional (`rejection_reason`). Remoção de item aprovado vira `isRemovalRequested = true` até servant aprovar (soft delete).

## Regras críticas de domínio

Não altere estes comportamentos sem conferir `BUSINESS_RULES.md`:

- `Resident` precisa de `house_id` e pelo menos um familiar/responsável.
- `Staff` com `house_id` serve na casa; `house_id = null` serve no grupo de apoio (sem casa associada).
- Transições de status de `Resident` são controladas por service.
- `RoutineEntry` não pode ser editada após 24h.
- `Incident` não pode ser deletada.
- Alta exige status `ACTIVE` ou `DISCIPLINE` e `exit_date`.
- Storeroom não tem estorno; correção é novo lançamento.

## Validação recomendada

- Mudanças só em tipos compartilhados: `pnpm build:types`.
- Mudanças no backend: `pnpm build:api` e, quando relevante, `pnpm test:api`.
- Mudanças em migration: rodar em banco local/teste antes de considerar pronto.
