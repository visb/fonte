# Plan: Eventos — inscrição pública + rename `associados` → `portal.fonte`

> Terceira fatia da feature Eventos. Depende de [[56]] (modelo `event`) e [[57]] (gestão no adm).
> Fecha a feature.

## Context

O público precisa **se inscrever** nos eventos a partir de um link, **sem login** (qualquer
pessoa). Hoje o app `apps/associados` é um web público de fluxo único (assinatura de doação via
link de pagamento). Como o app vira guarda-chuva de funcionalidades públicas (doações **+**
eventos), ele é **renomeado para `portal.fonte`** e passa a hospedar a lista pública de eventos +
o formulário de inscrição.

### Decisões travadas (do usuário)

- Inscrição **pública** (qualquer pessoa, sem conta). Dados coletados no próprio formulário.
- App `associados` **renomeado para `portal.fonte`** (nome guarda-chuva: doações + eventos +
  futuro público).
- Aplicar **limite de vagas** (`capacity`) e **janela de inscrição** (`registration_opens_at` /
  `registration_closes_at`) na inscrição.
- Reusar o backend de [[56]] (modelo `event`); inscrição é entidade nova `event_registration`.

## Desenho

### Backend — módulo `event` (continuação da [[56]])

- **Migration** `1783300000000-EventRegistrations.ts`: `event_registrations`:
  - `id` uuid PK, `event_id` uuid FK → `events` (ON DELETE CASCADE),
    `name` varchar not null, `contact` varchar not null (telefone/WhatsApp ou email — campo de
    contato livre validado), `email` varchar null, `created_at`, `deleted_at`.
  - Índice em `event_id`.
- **Entity** `event-registration.entity.ts`.
- **DTO** `RegisterToEventDto`: `name` (min 1), `contact` (min 1, validar formato básico),
  `email?` (IsEmail opcional).
- **Endpoints PÚBLICOS** (sem JWT, `@Controller('public/events')` + `ThrottlerGuard` + `@Throttle`
  por IP, padrão do `PublicAssociateController`):
  - `GET  /public/events` — lista eventos públicos com inscrição relevante (futuros / dentro de
    janela). Só campos seguros (sem dados internos). Banner via signed URL.
  - `GET  /public/events/:id` — detalhe público + se a inscrição está aberta + vagas restantes.
  - `POST /public/events/:id/register` — inscreve. Valida no service:
    - janela: agora dentro de `registration_opens_at`..`registration_closes_at` (se definidas);
      fora → 400/409 com mensagem clara.
    - lotação: se `capacity` definido e nº de inscrições ativas ≥ `capacity` → 409 "esgotado".
    - evento existente e não passado.
- **Endpoint ADMIN** (opcional, útil p/ a gestão): `GET /events/:id/registrations` — lista de
  inscritos (ADMIN+COORDINATOR). Atualizar [[57]] não é obrigatório; mínimo expor no backend.
- Contagem de vagas restantes = `capacity - count(inscrições ativas)`.
- Tipos em `@fonte/types` (`EventPublic`, `EventRegistration`, `RegisterToEventInput`,
  `EventRegistrationResult`) + recurso público no `@fonte/api-client`
  (`events.public.list/getById/register`). Postman atualizado.

### Rename do app `associados` → `portal.fonte`

- `git mv apps/associados apps/portal.fonte` (preserva histórico).
- `apps/portal.fonte/package.json`: `name` `associados` → `portal.fonte`.
- Ajustar: `vite.config.ts`, `playwright.config.ts`, `vitest.config.ts`, `tsconfig*.json`,
  `index.html` (título), referências internas.
- Raiz `package.json`: scripts `dev:associados`/`build:associados` → `dev:portal`/`build:portal`
  (manter alias antigo se algo externo depender — checar). Script de teste `test:associados`
  (epic 49) → `test:portal` (+ `:e2e`); atualizar `test:all`.
- `pnpm-workspace.yaml` já cobre `apps/*` — confirmar. Rodar `pnpm install` p/ reconciliar.
- Buscar e atualizar referências ao nome `associados` em CI, docs e `.env*`. Env de WhatsApp
  `APP_ASSOCIADOS_URL` (story 39): manter funcionando — atualizar para a nova URL do portal sem
  quebrar o link de pagamento existente (renomear var com cuidado ou manter compat documentada).
- Sentry: o app web público continua o mesmo projeto/DSN (`fonte-associados` no CLAUDE.md);
  documentar que o app foi renomeado mas o DSN segue (ou anotar TODO de renomear o projeto Sentry).

### Portal (app renomeado) — feature `events`

- Manter o fluxo de pagamento existente intacto (rotas `/p/:token`, `/cancelar/:token`).
- Nova feature pública de eventos (vertical slice, padrão do app):
  - `features/events/hooks/useEventsPublic.ts` — `usePublicEvents`, `usePublicEventById`,
    `useRegisterToEvent`. Query keys em `lib/queryKeys.ts`.
  - `pages/EventsListPage.tsx` (`/eventos`) — lista pública de eventos abertos.
  - `pages/EventDetailPage.tsx` (`/eventos/:id`) — detalhe + form de inscrição.
  - `components/EventRegistrationForm.tsx` — react-hook-form + zod (`name`, `contact`, `email?`);
    mostra vagas restantes / "inscrições encerradas" / "esgotado"; sucesso e erro via
    `getErrorMessage`. Estados Loading/Error compartilhados.
- Mobile-first (mesmo padrão visual do app público existente).

## Validação

- `pnpm test:api` — unit: register dentro da janela cria inscrição; fora da janela rejeita;
  `capacity` cheio → esgotado (409); count de vagas restantes correto; evento passado rejeita.
- `pnpm test:api:e2e` — e2e `public/events`: GET lista/detalhe público (sem dados internos),
  POST register sucesso, register esgotado 409, register fora da janela rejeitado, throttle.
- `pnpm test:portal` (+ `:e2e` Playwright) — unit do `EventRegistrationForm` (validação,
  estados esgotado/encerrado) + e2e do fluxo inscrever-se (mockando os endpoints públicos).
- `pnpm --filter portal.fonte build` verde (rename não quebrou). Regressão: `pnpm test:api:e2e`
  do fluxo de pagamento (associate) continua verde.
- `pnpm build:types` / `pnpm build:api-client` sem erro. Postman atualizado.

## Fora de escopo

- Login/conta para inscrição (decidido público).
- Check-in / presença no evento (a feature de grupos de apoio já tem checkin próprio).
- Pagamento de evento (inscrição é gratuita aqui).
- Renomear o projeto/DSN no Sentry (anotar TODO, não bloquear).
- Telas de eventos no `ops.fonte`/`app.fonte`.
