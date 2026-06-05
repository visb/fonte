# Plan: Sistema de notificações (adm.fonte + ops.fonte)

## Context

Nenhum app tem sistema de notificações (`grep -ri notif` → vazio em backend, adm e ops). Requisito: criar mecanismo para gerar **avisos sobre ações que ocorreram na plataforma** e exibi-los para os usuários.

Escopo de consumo (decisão do usuário — COORDINATOR usa o ops, **não** o adm):

- **adm.fonte** (web) — **ADMIN** (gestão central, todas as casas).
- **ops.fonte** (mobile) — **COORDINATOR + SERVANT**, escopados à **casa** do usuário (`Staff.house_id`).

Fontes de geração das notificações (ambas previstas):

1. **Ações de usuário** — disparadas dentro dos services no momento da ação (ex.: pagamento registrado, incidente criado).
2. **Background workers** — schedulers periódicos que avaliam estado e emitem avisos (ex.: parcela vencida, rotina do dia não preenchida, documento obrigatório faltando). O backend já usa `@nestjs/schedule` — ver `services/api/src/modules/storeroom/storeroom-usage.scheduler.ts` e `storage/signed-url-cache.scheduler.ts` como referência de padrão.

> Escopo desta fase: notificações **in-app**, geradas no backend e entregues em **tempo real via WebSocket** (socket.io) ao adm e ops (decisão do usuário). REST para carga inicial/histórico/marcar lida. Push nativo (expo-notifications) e e-mail ficam para fase futura — modelo de dados já preparado para evoluir.

---

## Backend — novo módulo `notification`

Espelhar estrutura dos módulos existentes (`services/api/src/modules/<mod>`: entity, dto, service, controller, scheduler, module).

### 1. Entity — `notification.entity.ts`

Alvo flexível para atender adm (por role) e ops (por casa):

```typescript
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;

  // Alvo direto a um usuário específico (null = usa role/house abaixo).
  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId: string | null;

  // Alvo por papel (ex.: COORDINATOR). null = qualquer papel.
  @Column({ name: 'recipient_role', type: 'enum', enum: Role, enumName: 'user_role_enum', nullable: true })
  recipientRole: Role | null;

  // Escopo por casa (notificações do ops escopadas à casa). null = todas.
  @Column({ name: 'house_id', type: 'uuid', nullable: true })
  houseId: string | null;

  @Column({ type: 'enum', enum: NotificationType, enumName: 'notification_type_enum' })
  type: NotificationType;

  @Column({ type: 'varchar' }) title: string;
  @Column({ type: 'text', nullable: true }) body: string | null;

  // Deep-link in-app. Pode divergir por app (web: /residents/:id, ops: rota mobile).
  @Column({ name: 'link', type: 'varchar', nullable: true }) link: string | null;

  // Metadados livres (entityId, etc.).
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null;

  // Leitura por usuário: tabela separada (broadcast lido por vários).
  // Ver nota "Leitura de broadcast" abaixo.

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt: Date | null;
}
```

**Leitura de broadcast** — como uma notificação broadcast é lida por vários usuários, `read_at` único na linha não serve. Duas opções:

- (A) Tabela `notification_reads (notification_id, user_id, read_at)` — leitura por usuário. Mais correto; preferir.
- (B) Notificações sempre materializadas por destinatário (1 linha por usuário) — simples, mas explode volume em broadcast amplo.

Esta story adota **(A)**: entity `NotificationRead` + join para computar `read` por usuário.

### 2. Enums em `packages/types/src/index.ts`

```typescript
export enum NotificationType {
  // ações de usuário
  ADMISSION_CREATED = 'ADMISSION_CREATED',
  PAYMENT_REGISTERED = 'PAYMENT_REGISTERED',
  INCIDENT_CREATED = 'INCIDENT_CREATED',
  RESIDENT_DISCHARGED = 'RESIDENT_DISCHARGED',
  // background workers
  RECEIVABLE_OVERDUE = 'RECEIVABLE_OVERDUE',
  ROUTINE_MISSING = 'ROUTINE_MISSING',
  REQUIRED_DOC_MISSING = 'REQUIRED_DOC_MISSING',
  // ... expandir conforme eventos cobertos
}
```

`Role` já existe em `@fonte/types`.

### 3. Migration

`services/api/src/database/migrations/<ts>-Notifications.ts` — cria `notification_type_enum`, tabela `notifications` e tabela `notification_reads` (snake_case, UUID v4, soft delete `deleted_at`). FK `notification_reads.notification_id → notifications.id`.

### 4. Service — `notification.service.ts`

- `create(input)` — usado por services emissores e schedulers. `input`: `{ type, title, body?, link?, metadata?, recipientId?, recipientRole?, houseId? }`.
- `listForUser(user, { unreadOnly?, page? })` — retorna notificações cujo alvo bate com o usuário:
  - `recipientId === user.id`, **ou**
  - `recipientId IS NULL` e (`recipientRole IS NULL` ou `= user.role`) e (`houseId IS NULL` ou `= user.houseId`).
  - Computa `read` via `notification_reads`.
- `unreadCount(user)`.
- `markRead(id, user)` — insere/atualiza `notification_reads`.
- `markAllRead(user)`.

Exposto via interface clara (CLAUDE.md). Outros módulos **não** acessam a tabela direto — chamam `NotificationService`.

### 5. Emissão — ações de usuário

Injetar `NotificationService` nos services emissores e chamar `create(...)` no ponto da ação. **Best-effort**: try/catch + log; falha ao notificar não quebra a ação principal.

| Evento | Onde emitir | Alvo |
| --- | --- | --- |
| Acolhimento concluído (status → ACTIVE) | `resident.service.ts` | ADMIN (adm) + casa do residente (ops: COORDINATOR+SERVANT) |
| Pagamento registrado | `resident-receivable.service.ts` `registerPayment` | ADMIN (adm) |
| Incidente criado | `incident.service.ts` create | ADMIN (adm) + casa do incidente (ops) |
| Alta | `resident.service.ts` (fluxo de alta) | ADMIN (adm) + casa do residente (ops) |

> Alvo "ADMIN" = `recipientRole: ADMIN`, `houseId: null` (consumido no adm). Alvo "casa" = `houseId: <id>`, `recipientRole: null` (consumido no ops por COORDINATOR/SERVANT daquela casa).

### 6. Emissão — background workers

Novo `notification.scheduler.ts` (ou schedulers por domínio) usando `@Cron` do `@nestjs/schedule` (módulo já importado em `app.module.ts`):

| Worker | Regra | Tipo | Alvo | Fase |
| --- | --- | --- | --- | --- |
| Parcelas vencidas | `@Cron('0 8 * * *')` varre `resident_receivables` PENDING com `due_date < hoje` | `RECEIVABLE_OVERDUE` | ADMIN (adm) | **1ª entrega** |
| Rotina não preenchida | `@Cron('0 21 * * *')` casas sem `RoutineEntry` do dia | `ROUTINE_MISSING` | casa (ops) | adiado |
| Documento obrigatório faltando | `@Cron('30 8 * * *')` residentes ACTIVE sem doc obrigatório assinado | `REQUIRED_DOC_MISSING` | ADMIN (adm) + casa (ops) | adiado |

Apenas **`RECEIVABLE_OVERDUE`** entra na 1ª entrega (decisão §3 abaixo). TZ `America/Sao_Paulo`.

Workers devem ser **idempotentes** — não duplicar aviso já emitido no período (checar via `metadata`/janela de tempo antes de `create`).

### 7. Controller — `notification.controller.ts`

```
GET    /notifications            → lista do usuário autenticado (?unreadOnly)
GET    /notifications/unread-count
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
```

Auth via guard JWT existente; usa `user.id`, `user.role`, `user.houseId` do token. Disponível para Staff (ADMIN no adm; COORDINATOR/SERVANT no ops). O `listForUser` já filtra por role/casa, então cada app só recebe o que lhe cabe sem lógica extra no controller.

### 7b. WebSocket Gateway — `notification.gateway.ts` (realtime)

> **Pré-requisito de infra (verificar antes de commitar o realtime — decisão do usuário "não sei, verifique"):** confirmar que o deploy de produção suporta upgrade de conexão WebSocket. Checar config de proxy reverso (nginx/traefik/host PaaS), CORS e se o gateway sobe na mesma porta/host do HTTP ou exige porta dedicada. **Se não suportar**, reportar antes de prosseguir — alternativa seria degradar para polling, mas isso **muda a decisão §1** e precisa de novo aval. Não commitar realtime sem essa confirmação.

Greenfield (sem socket no repo). Adicionar deps `@nestjs/websockets` + `@nestjs/platform-socket.io` (e `socket.io` transitivo) no `services/api`.

- `@WebSocketGateway` em namespace `/notifications`.
- **Auth no handshake**: validar JWT (token via `handshake.auth.token`) reusando a lógica do guard existente; rejeitar conexão sem token válido.
- **Rooms** por alvo, para entregar só a quem interessa: ao conectar, juntar o socket às rooms `user:<id>`, `role:<role>` e (se houver) `house:<houseId>`.
- `NotificationService.create(...)` passa a **emitir** para as rooms correspondentes ao alvo (`server.to(rooms).emit('notification:new', payload)`), além de persistir. Service depende do gateway via interface clara (ou o gateway escuta um `EventEmitter2` interno emitido pelo service — preferir `EventEmitter2` para evitar dependência circular service↔gateway).
- Eventos emitidos: `notification:new` (payload da notificação) e `notification:unread-count` (novo total) — ou só `notification:new` e o cliente reconsulta o count.

Vale para ações de usuário (§5) e workers (§6): ambos passam por `create(...)`, então o push é automático.

### 8. Postman

Atualizar `fonte-api.postman_collection.json` com os 4 endpoints.

---

## api-client (compartilhado adm + ops)

`packages/api-client`:
- Tipos `Notification`, `NotificationType` em `types.ts`.
- Métodos `api.notifications.list(params)`, `unreadCount()`, `markRead(id)`, `markAllRead()` em `index.ts`.

Ambos os apps consomem o mesmo cliente (CLAUDE.md: não duplicar chamada HTTP por app).

---

## Frontend — adm.fonte

Nova feature `features/notifications/`.

### 9. Hooks — `features/notifications/hooks/useNotifications.ts`

```typescript
export function useNotifications(params?) { ... }      // useQuery (carga inicial/histórico)
export function useUnreadCount() { ... }               // useQuery (sem polling — atualizado via socket)
export function useMarkNotificationRead() { ... }       // useMutation
export function useMarkAllNotificationsRead() { ... }   // useMutation
export function useNotificationSocket() { ... }         // conecta socket.io, invalida queries on push
```

`useNotificationSocket` (montado uma vez, ex.: no `NotificationBell` ou num provider): conecta ao namespace `/notifications` com `auth: { token }`; no evento `notification:new`, invalida `queryKeys.notifications.all` e `.unreadCount` (ou faz update otimista do count). Desconecta no logout/unmount. Sem `refetchInterval`.

Query keys em `lib/queryKeys.ts`:

```typescript
notifications: {
  all: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
},
```

Mutations invalidam `queryKeys.notifications.all` e `.unreadCount`. Dep nova: `socket.io-client` no `adm.fonte`.

### 10. UI

- `NotificationBell.tsx` — ícone `Bell` (lucide) + badge (`useUnreadCount`), no header de `components/layout/AppLayout.tsx`.
- `NotificationsPanel.tsx` — dropdown/sheet; usa `useNotifications`; botão "Marcar todas como lidas".
- `NotificationItem.tsx` — item extraído (título, corpo, tempo relativo, link). Clicar marca lida e navega ao `link`.
- `NotificationsPage.tsx` + rota `/notifications` (histórico) — **incluído** (decisão §5).

Estados via `LoadingState`/`EmptyState`/`ErrorState`.

---

## Frontend — ops.fonte

Nova feature `apps/ops.fonte/features/notifications/` seguindo o mesmo padrão (estrutura idêntica ao restante de `ops.fonte/features`).

### 11. Hooks

Mesmo contrato dos hooks do adm, usando `lib/api.ts` e `lib/queryKeys.ts` do ops. Adicionar chave `notifications` em `apps/ops.fonte/lib/queryKeys.ts`. `useNotificationSocket` com `socket.io-client` (RN suporta) conectando ao namespace `/notifications`; on `notification:new` invalida as queries. Reconectar quando `AppState` volta a `active` (socket pode cair em background). Sem polling. Dep nova: `socket.io-client` no `ops.fonte`.

### 12. UI (React Native)

- Sino + badge no header do app ops (localizar o header/topbar do ops; se não houver componente único, adicionar ao layout de `app/`).
- Tela/sheet de lista usando `FlatList`; item extraído como `NotificationRow` (CLAUDE.md: item de lista é componente próprio). Estados de loading/empty/error com os componentes equivalentes do ops.
- Notificações chegam escopadas à casa do operador (backend filtra por `houseId`).

---

## Decisões (resolvidas)

1. **Transporte**: **WebSocket realtime** (socket.io). Backend expõe um gateway; adm e ops conectam e recebem push instantâneo. REST permanece para carga inicial, histórico e marcar lida. Não há infra de socket hoje — greenfield (ver §7b). Push nativo (expo-notifications) = fase futura.
2. **Modelo de leitura**: **tabela `notification_reads`** (opção A). Decidido — `read` computado por join, suporta broadcast lido por vários.
3. **Escopo da 1ª entrega** (eventos que vão no primeiro merge):
   - Ações de usuário (§5): `ADMISSION_CREATED`, `PAYMENT_REGISTERED`, `INCIDENT_CREATED`, `RESIDENT_DISCHARGED` — **todos os 4**.
   - Background worker (§6): apenas **`RECEIVABLE_OVERDUE`**.
   - **Adiados** para iteração seguinte: workers `ROUTINE_MISSING` e `REQUIRED_DOC_MISSING` (manter no enum e na doc, mas não implementar o scheduler agora).
4. **Cadência dos crons** (TZ `America/Sao_Paulo`, já a TZ do servidor):
   - `RECEIVABLE_OVERDUE` → diário **08:00** (`@Cron('0 8 * * *')`).
   - (futuros) `ROUTINE_MISSING` → diário 21:00; `REQUIRED_DOC_MISSING` → diário 08:30.
5. **Página de histórico**: **incluir** `NotificationsPage` + rota `/notifications` no **adm**. No **ops**, apenas sheet/lista (sem rota dedicada nesta fase).

---

## Testes automatizados (obrigatório — Definition of Done)

Story só conclui com testes automatizados verdes em backend, adm e ops.

| Arquivo | Caso |
| --- | --- |
| `services/api/src/modules/notification/notification.service.spec.ts` (novo) | `create`; `listForUser` resolve alvo por `recipientId`, por `recipientRole` e por `houseId`; usuário não vê notificação de outra casa/role; `unreadCount`; `markRead`/`markAllRead` via `notification_reads` |
| `services/api/src/modules/notification/notification.scheduler.spec.ts` (novo) | Worker de parcelas vencidas emite `RECEIVABLE_OVERDUE` para parcela PENDING vencida; **idempotência** — segunda execução no mesmo período não duplica |
| `services/api/test/notifications.e2e-spec.ts` (novo) | 4 endpoints com auth; COORDINATOR/SERVANT de uma casa não lê notificação de outra casa; aviso `recipientRole: ADMIN` visível só para ADMIN (adm), não para ops |
| `services/api/test/notifications-gateway.e2e-spec.ts` (novo) | Cliente socket.io autentica no handshake (token inválido → recusado); ao `create(...)` uma notificação para o alvo, o cliente conectado na room correta recebe `notification:new`; cliente de outra casa/role **não** recebe |
| `services/api/test/resident-receivable.e2e-spec.ts` | Registrar pagamento **gera** notificação `PAYMENT_REGISTERED`; emissão best-effort não quebra a ação |
| `apps/adm.fonte/e2e/notifications.spec.ts` (novo) | Badge com contagem; painel lista avisos; marcar lida zera badge; clicar navega ao `link` |
| `apps/ops.fonte/e2e/notifications.yaml` (novo, Maestro) | Sino com badge; abrir lista; tocar item; notificação escopada à casa do operador aparece |

Best-effort: teste com mock do `NotificationService.create` lançando erro → ação emissora ainda conclui (cobre §5 e §6).

Rodar:
- `pnpm test:api` (unit: service + scheduler)
- `pnpm test:api:e2e`
- `pnpm test:adm` (Playwright)
- `pnpm test:ops` (Maestro — emulador/dispositivo + API teste + Metro; `adb reverse` se necessário)

Todos verdes.

## Verificação manual

1. `pnpm build:types` / `pnpm build:api-client` — compilam.
2. `pnpm dev:api` — migration roda; `GET /notifications` retorna lista; registrar pagamento gera notificação e emite no socket; forçar execução do worker `RECEIVABLE_OVERDUE` gera aviso.
3. `pnpm dev:adm` — login como ADMIN; gerar um evento em outra sessão → notificação aparece **na hora** (socket), badge incrementa sem refresh; marcar lida zera badge; clicar navega.
4. `pnpm dev:ops` — login como COORDINATOR ou SERVANT de uma casa; receber push em tempo real escopado à casa; lista mostra apenas avisos da casa; tocar navega.
5. Postman atualizado e endpoints testados.
