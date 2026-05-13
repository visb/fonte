# Mapa do projeto para IA

## Visão geral

`fonte` é um monorepo pnpm da plataforma operacional da comunidade terapêutica Fonte de Misericórdia.

- `services/api` — API NestJS centralizada.
- `apps/adm.fonte` — app web administrativo em React/Vite.
- `apps/ops.fonte` — PWA/mobile Expo para operadores da casa.
- `apps/app.fonte` — app mobile Expo para familiares (role RELATIVE).
- `packages/types` — tipos compartilhados entre backend, frontends e cliente HTTP.
- `packages/api-client` — cliente HTTP compartilhado usado pelos frontends.
- `BUSINESS_RULES.md` — regras de negócio e permissões por role.
- `CONTRIBUTING.md` — convenção de commits.

## Onde procurar

| Tarefa | Comece por |
| --- | --- |
| Regra de negócio ou permissão | `BUSINESS_RULES.md`, depois `services/api/src/modules/*` |
| Endpoint/API | `services/api/src/modules/<domínio>` |
| DTO ou contrato compartilhado | `packages/types/src/index.ts` |
| Chamada HTTP usada por frontend | `packages/api-client/src/modules/*` |
| Tela administrativa | `apps/adm.fonte/src/pages/*` |
| Layout/rotas web admin | `apps/adm.fonte/src/App.tsx`, `apps/adm.fonte/src/components/layout/*` |
| Tela do app de operação | `apps/ops.fonte/app/*` |
| Autenticação frontend | `apps/adm.fonte/src/contexts/AuthContext.tsx`, `apps/ops.fonte/lib/auth.tsx` |
| Configuração de API frontend | `apps/adm.fonte/src/lib/api.ts`, `apps/ops.fonte/lib/api.ts` |
| Banco/migrations | `services/api/src/database/*` |
| Grupos de apoio (backend) | `services/api/src/modules/support-group/` |
| Grupos de apoio (adm) | `apps/adm.fonte/src/features/support-groups/` |
| Grupos de apoio (ops checkin) | `apps/ops.fonte/features/support-groups/` |
| Acesso de resident (gerar/resetar senha) | `apps/adm.fonte/src/features/residents/components/GenerateResidentAccessDialog.tsx` |
| Sessão/timer de uso de resident | `services/api/src/modules/resident-session/` |
| Mensagens entre residents e familiares | `services/api/src/modules/message/`, `apps/ops.fonte/features/messages/`, `apps/app.fonte/features/messages/` |
| Lista de pedidos (wishlist) | `services/api/src/modules/wishlist/`, `apps/ops.fonte/features/wishlist/`, `apps/app.fonte/features/wishlist/` |
| Timer limitado no ops.fonte | `apps/ops.fonte/lib/UsageTimerContext.tsx`, `apps/ops.fonte/components/TimeLimitedScreen.tsx` |
| Auth familiar (gerar/resetar senha) | `apps/adm.fonte/src/features/residents/components/GenerateRelativeAccessDialog.tsx` |
| App familiar — auth, home, mensagens | `apps/app.fonte/lib/auth.tsx`, `apps/app.fonte/features/home/`, `apps/app.fonte/features/messages/` |
| App familiar — pedidos, check-in | `apps/app.fonte/features/wishlist/`, `apps/app.fonte/features/checkin/` |
| Check-in de familiar em grupo de apoio | `services/api/src/modules/support-group/support-group-relative-checkin.entity.ts` |

## Fluxo de dependência

```text
services/api ─┐
              ├─ depende de @fonte/types
apps/adm.fonte ─┬─ depende de @fonte/types
apps/ops.fonte ─┤
                └─ depende de @fonte/api-client ─ depende de @fonte/types
```

Quando `packages/types/src/index.ts` mudar, reconstrua `@fonte/types`. Quando o cliente HTTP mudar, reconstrua `@fonte/api-client` antes de validar apps consumidores.

## Regras de leitura para IA

- Não carregue todos os arquivos por padrão; use este mapa para abrir só o necessário.
- Antes de propor alteração, leia o arquivo real afetado.
- Se uma orientação deste diretório conflitar com o código atual, confie no código e atualize o guia.
