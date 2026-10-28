# Plan: módulo Daily no `ops.fonte` — board de ministérios em tempo real

## Context

Todo dia os coordenadores da casa fazem uma reunião (a "daily") para organizar os ministérios e
designar filhos e servos para cada um. Hoje isso é feito no papel/de cabeça e depois lançado
ministério a ministério no app (`/ministries/[id]` → adicionar/remover membro), um por vez.

Pedido do usuário: um módulo **Daily** no `ops.fonte` com um **board** de todos os ministérios da
casa, onde se **pressiona e arrasta** filhos e servos de um ministério para outro. O board é
**compartilhado em tempo real** entre vários celulares, para os coordenadores organizarem juntos
na reunião, cada um no seu aparelho.

- Há uma caixa **"Sem ministério"** com os filhos e servos ainda não designados.
- O board **começa pré-preenchido** com o estado atual dos ministérios.
- Filhos e servos ocupam **as mesmas listas**. Única diferença visual: o servo tem um **badge com
  o nível** (`staff.rank`: Aspirante / Consagrado / Aliançado). O filho mostra só nome e foto.

Estado atual do modelo (relevante):
- Filho → no máximo 1 ministério (`residents.ministry_id`), elegibilidade por
  `isMinistryEligibleResident` (`packages/types`): mesma casa + status removível.
- Servo → N ministérios (`ministry_staff`, M:N).
- Add/remove de membro já existe em `ministry.service.ts` (`addResident`/`removeResident`/
  `addStaff`/`removeStaff`), com auditoria (`trackResidentLink`/`trackStaffLink`, story 199).
- Realtime já existe: `NotificationGateway` (socket.io, namespace `/notifications`, JWT no
  handshake, rooms `house:<id>`). `socket.io-client`, `react-native-gesture-handler` e
  `react-native-reanimated` já são dependências do `ops.fonte`.

### Decisões travadas (usuário)

1. **Rascunho compartilhado + "Aplicar".** Arrastar **não** altera os ministérios reais. A daily é
   uma sessão (rascunho) da casa; todos veem cada movimento em tempo real. Ao final, um coordenador
   toca **"Aplicar"** e o backend grava tudo nos ministérios numa transação, com auditoria. Permite
   experimentar sem bagunçar os vínculos ao vivo nem gerar um evento de auditoria por arrasto.
2. **Uma pessoa = um ministério no board.** Cada servo aparece em uma coluna só; arrastar = mover.
   Ao aplicar, o servo fica **somente** no ministério do board (perde os outros vínculos
   `ministry_staff`). Servo que hoje está em vários entra pré-preenchido no vínculo mais antigo
   (`ministry_staff.created_at` ASC) e o card mostra um aviso discreto ("estava em N ministérios").
3. **Acesso: ADMIN + COORDINATOR.** Só eles abrem e editam. SERVANT não vê o item no menu e a API
   responde 403.

### Decisões de desenho (defaults assumidos no refino)

4. **Uma sessão aberta por casa.** `GET /daily/current?houseId=` devolve a sessão `OPEN` da casa;
   se não existir, cria e pré-preenche a partir do estado real. Sessão aplicada vira `APPLIED`
   (somente leitura, histórico). Depois de aplicar, o board mostra "Aplicado às HH:mm por Fulano" e
   o botão **"Nova daily"**, que abre nova sessão pré-preenchida do estado (agora já aplicado).
   Sessão `OPEN` de dia anterior não aplicada é **descartada** (`DISCARDED`) na próxima abertura e
   uma nova é pré-preenchida — a daily é do dia.
5. **Quem entra no board** (recalculado a cada `GET`, não só na criação):
   - filhos elegíveis da casa (`isMinistryEligibleResident`);
   - staff **ativo** da casa (`active-staff.ts`), de qualquer role.
   - Pessoa nova (acolhida/contratada depois do pré-preenchimento) entra em "Sem ministério".
     Pessoa que deixou de ser elegível sai do board. Ministério excluído: seus membros vão para
     "Sem ministério"; ministério criado aparece como coluna vazia.
6. **Badge do servo:** `rank` (Aspirante/Consagrado/Aliançado, cores em `constants.ts`). Staff sem
   `rank` (ADMIN/COORDINATOR) mostra o badge com o label do papel ("Coordenador"), para nunca ficar
   indistinguível de um filho.
7. **Conflito: última escrita vence, por pessoa.** Cada movimento é um `POST` atômico que grava o
   destino da pessoa e incrementa `version` da sessão. O servidor emite o evento para os outros
   aparelhos. Se chega um movimento remoto da pessoa que o usuário está arrastando, o arrasto local
   é cancelado e o card vai para o destino remoto. Cliente que perde eventos (reconexão, `version`
   com salto) refaz o `GET` completo.
8. **Aplicar** (`POST /daily-sessions/:id/apply`), numa transação:
   - revalida elegibilidade de cada pessoa; quem não for mais elegível é **pulado** e listado na
     resposta (`skipped[]` com motivo), sem abortar o resto;
   - filho: `ministry_id` = destino (ou `NULL` em "Sem ministério");
   - servo: vínculos `ministry_staff` ficam exatamente `{destino}` (ou nenhum);
   - só gera auditoria para o que **mudou** (diff contra o estado real), reaproveitando
     `trackResidentLink`/`trackStaffLink` — extrair para métodos internos do `MinistryService` que
     aceitem o `EntityManager` da transação, sem duplicar a regra;
   - sessão → `APPLIED` (`applied_at`, `applied_by_user_id`), emite `daily:applied`.
   - Aplicar sessão já `APPLIED`/`DISCARDED` → 409.
   - Confirmação no app antes de aplicar ("Aplicar a daily? X mudanças nos ministérios").
9. **Liderança fora do board.** `ministries.leader_id` não muda pelo board. Se o líder for movido
   para outro ministério, ele continua líder do original (regra atual do módulo).
10. **Realtime: gateway novo `DailyGateway`, namespace `/daily`.** Mesmo esquema de auth do
    `NotificationGateway` (JWT no handshake). O cliente emite `daily:join { sessionId }`; o gateway
    valida role (ADMIN/COORDINATOR) e casa (coordenador só da própria casa) antes de colocar o
    socket na room `daily:<sessionId>`; recusa → `daily:error`. Eventos servidor→cliente:
    `daily:moved { personType, personId, toMinistryId, version, movedByUserId }`, `daily:applied`,
    `daily:reset` (nova sessão aberta). O movimento entra por HTTP (validado por DTO), não pelo
    socket — o socket só distribui. Emissão via `EventEmitter2` (`@OnEvent`), como nas notificações.
11. **Precisa de rede (não é fluxo de campo offline).** O board não entra na allowlist de
    persistência offline nem na outbox. Sem rede: banner "A daily precisa de conexão", board em
    somente leitura com o último estado em memória, arrasto e "Aplicar" desabilitados. Ao voltar,
    `GET` completo. Erro de rede não desloga (só 401 real).
12. **UX no celular:** ministérios empilhados **verticalmente** (não colunas horizontais — arrastar
    entre colunas com scroll horizontal no celular é ruim), cada um como caixa com título +
    contador; "Sem ministério" fixa no topo. Arrasto: long-press (~300ms, háptico) → card flutua →
    auto-scroll nas bordas → solta sobre a caixa destino (realce no hover). **Alternativa por
    toque:** tocar no card abre o sheet "Mover para…" com a lista de ministérios — acessibilidade
    e caminho determinístico para o Maestro (que não arrasta de forma confiável).
13. **Ordem dentro da caixa:** alfabética por nome (sem ordenação manual; o board não guarda
    posição).
14. **Nome do módulo:** "Daily" no menu e na rota `/daily`; backend `modules/daily`.

---

## Desenho

### Backend (`services/api/src/modules/daily`)

Migration nova:

```
daily_sessions
  id uuid pk, house_id uuid fk houses, status varchar(10) ('OPEN'|'APPLIED'|'DISCARDED'),
  session_date date, version int default 0,
  created_by_user_id uuid, applied_at timestamptz null, applied_by_user_id uuid null,
  created_at, updated_at
  unique parcial (house_id) where status = 'OPEN'

daily_session_assignments
  id uuid pk, session_id uuid fk daily_sessions on delete cascade,
  person_type varchar(10) ('RESIDENT'|'STAFF'), person_id uuid,
  ministry_id uuid null fk ministries,      ← null = "Sem ministério"
  updated_by_user_id uuid, updated_at
  unique (session_id, person_type, person_id)
```

(Sessão de rascunho não tem soft delete — é dado efêmero de trabalho; o histórico real fica na
auditoria dos ministérios. `DISCARDED` cobre o descarte.)

```
daily.module.ts
daily-session.entity.ts / daily-session-assignment.entity.ts
daily.controller.ts        ← GET /daily/current, POST /daily-sessions/:id/moves,
                             POST /daily-sessions/:id/apply, POST /daily (nova daily após aplicar)
daily.service.ts           ← open/prefill/sync (decisões 4–5), move (7), apply (8)
daily.gateway.ts           ← namespace /daily (decisão 10)
daily.events.ts
dto/move-daily-person.dto.ts  ← personType @IsIn, personId @IsUUID, toMinistryId @IsUUID|null
```

- `@Roles(Role.ADMIN, Role.COORDINATOR)` em todos; coordenador restrito à própria casa no service
  (403 para outra casa). ADMIN informa `houseId`.
- `move`: valida que a pessoa está no board da sessão e que o ministério destino é da casa e não
  está excluído (400); sessão não `OPEN` → 409; `UPDATE` da assignment + `version = version + 1`
  na mesma transação; emite evento.
- Resposta do `GET`: `{ session, ministries: [{ id, name, members: DailyPerson[] }], unassigned:
  DailyPerson[] }` com `DailyPerson = { type, id, name, photoThumbUrl, rank?, roleLabel?,
  hadMultipleMinistries? }`.
- `MinistryService`: extrair `setResidentMinistry(m, residentId, ministryId|null)` e
  `setStaffMinistry(m, staffId, ministryId|null)` com auditoria por diff, usados pelo `apply` (os
  endpoints atuais continuam iguais).
- `BUSINESS_RULES.md`: seção *Daily* — quem acessa, rascunho vs aplicar, "uma pessoa = um
  ministério" ao aplicar (servo perde vínculos extras), pulados na aplicação.
- `fonte-api.postman_collection.json`: os 4 endpoints com bodies e respostas 400/403/409.

### Contratos

- `packages/types`: `DailySessionStatus`, `DailyPersonType`, `DailyPerson`, `DailyBoard`,
  `MoveDailyPersonInput`, `ApplyDailyResult { applied: number; skipped: {personType, personId,
  reason}[] }`, nomes dos eventos socket. `pnpm build:types`.
- `packages/api-client`: `daily.current(houseId)`, `daily.move(sessionId, input)`,
  `daily.apply(sessionId)`, `daily.start(houseId)`. `pnpm build:api-client`.

### `ops.fonte` (`features/daily/`)

```
constants.ts                      ← cores/labels de rank, threshold do long-press, mensagens
hooks/useDaily.ts                 ← useDailyBoard(houseId), useMoveDailyPerson, useApplyDaily, useStartDaily
hooks/useDailySocket.ts           ← conecta /daily, join, aplica daily:moved no cache (setQueryData), refetch em salto de version/reconexão
lib/dailyBoard.ts                 ← funções puras: applyMove(board, move), countChanges, detecção de salto de version
components/DailyBoard.tsx         ← lista vertical de caixas + camada de drag (gesture-handler/reanimated)
components/DailyMinistryBox.tsx   ← caixa (título, contador, drop zone com realce)
components/DailyPersonCard.tsx    ← foto + nome; badge só para STAFF
components/DailyRankBadge.tsx
components/DailyDraggableCard.tsx ← long-press → drag; tap → MoveToSheet
components/MoveToSheet.tsx        ← "Mover para…"
components/DailyApplyBar.tsx      ← botão Aplicar + confirmação + estado "Aplicado às…"/"Nova daily"
components/DailyOfflineBanner.tsx
pages/DailyPage.tsx
app/(app)/daily/_layout.tsx, index.tsx
features/menu                     ← item "Daily" só para ADMIN/COORDINATOR
```

- Query keys novas em `lib/queryKeys.ts` (`queryKeys.daily.board(houseId)`), nunca literal.
- Movimento: update otimista via `setQueryData` + rollback no erro (`getErrorMessage` no toast).
  Mutations do daily **não** usam outbox/`networkMode: 'offlineFirst'` (decisão 11) — exigem rede
  e ficam desabilitadas offline.
- Socket: reaproveitar a fábrica/URL do `useNotifications` (extrair helper compartilhado se a
  lógica de conexão for duplicar).
- Componentes ≤ ~150 linhas; item de lista sempre extraído (`DailyPersonCard`).
- Loading/erro/vazio com os componentes de estado do ops (criar se ainda não houver, conforme
  CLAUDE.md).

---

## Validação

### Backend: unit (`pnpm test:api`, `daily.service.spec.ts`, `daily.gateway.spec.ts`)

- **Abertura/pré-preenchimento:** sem sessão → cria `OPEN` com filhos no `ministry_id` atual,
  servos no vínculo mais antigo (`hadMultipleMinistries` true quando tinha >1), sem vínculo →
  "Sem ministério"; sessão `OPEN` de dia anterior → `DISCARDED` + nova; segundo `GET` no mesmo dia
  devolve a mesma sessão.
- **Sync no GET:** filho acolhido depois entra em "Sem ministério"; filho que virou inelegível e
  staff desligado saem; membros de ministério excluído vão para "Sem ministério".
- **Move:** grava destino e incrementa `version`; destino `null` ok; ministério de outra casa ou
  excluído → 400; pessoa fora do board → 400; sessão `APPLIED` → 409; emite evento com `version`.
- **Apply:** filho muda `ministry_id`; servo em 3 ministérios fica só no destino; "Sem ministério"
  zera vínculos; auditoria só para o que mudou (sem evento para quem não mudou); inelegível no
  momento do apply vai para `skipped` e o resto aplica; sessão vira `APPLIED` com `applied_by`;
  aplicar de novo → 409; falha no meio → rollback total (nada aplicado).
- **Permissões:** SERVANT → 403 em todos; COORDINATOR de outra casa → 403; ADMIN qualquer casa.
- **Gateway:** handshake sem/ com token inválido → desconecta; `daily:join` de SERVANT ou de
  coordenador de outra casa → `daily:error` e não entra na room; join válido entra em
  `daily:<sessionId>`; `@OnEvent` emite só para a room da sessão.
- `MinistryService.setResidentMinistry`/`setStaffMinistry`: testes próprios + regressão dos
  endpoints add/remove atuais.

### Backend: e2e (`pnpm test:api:e2e`, `daily.e2e-spec.ts`)

- Coordenador: `GET /daily/current` → board pré-preenchido; `POST moves` → `version` sobe;
  `POST apply` → `GET /ministries/:id` reflete; `POST apply` de novo → 409; `POST /daily` → nova
  sessão.
- Dois clientes socket.io na room: move de um chega como `daily:moved` no outro (padrão de
  `notifications-gateway.e2e-spec.ts`).
- SERVANT → 403. Fixtures próprias (casa/ministérios/filhos/servos criados pelo teste) removidas
  por id; nada do seed mutado (story 182).

### Contratos

- `pnpm build:types`, `pnpm build:api-client`, `pnpm test:api-client` (métodos `daily.*`).
  Postman atualizado.

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- `lib/dailyBoard.ts`: `applyMove` (entre caixas, para/de "Sem ministério", pessoa inexistente =
  no-op), `countChanges`, detecção de salto de `version`.
- `useDailySocket`: `daily:moved` atualiza o cache; salto de version → refetch; reconexão →
  refetch; `daily:applied` → board somente leitura; `daily:error` mostra aviso.
- `useMoveDailyPerson`: otimista + rollback com toast no erro.
- `DailyPersonCard`: filho sem badge; servo com badge do rank; staff sem rank com label do papel;
  aviso "estava em N ministérios".
- `MoveToSheet`: lista ministérios + "Sem ministério"; escolher dispara o move.
- `DailyApplyBar`: confirmação com contagem; após aplicar mostra "Aplicado às…" e "Nova daily";
  mostra `skipped` quando houver.
- Offline (`DailyOfflineBanner` + board): sem rede → banner, arrasto/tap/aplicar desabilitados.
- Menu: item "Daily" visível para ADMIN/COORDINATOR e oculto para SERVANT.

### `ops.fonte`: Maestro (`pnpm test:ops`, `e2e/daily.yaml`)

- Coordenador abre Daily → vê ministérios e "Sem ministério" pré-preenchidos → toca num filho →
  "Mover para…" → ministério X → card aparece em X → Aplicar → confirmar → "Aplicado às…" → abre
  `/ministries/X` e o filho está lá.
- Servo: menu sem "Daily".
- Fixtures próprias via API, removidas por id (story 182). Drag em si coberto pelo unit + teste
  manual (Maestro não arrasta de forma confiável).

### `ops.fonte`: web offline (`e2e-web/`, Playwright)

- `context.setOffline(true)` com o board aberto → banner aparece, ações desabilitadas; voltar a
  rede → board recarrega e ações voltam.

### Teste manual (registrar no fechamento)

- Dois celulares reais na mesma daily: long-press/arrasto/auto-scroll; movimento aparece no outro
  em <1s; arrasto simultâneo da mesma pessoa cancela o local.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste.
Rodar `pnpm test:api:cov` e a cobertura de `pnpm test:ops:unit`; `modules/daily` e
`features/daily` ≥90%, **sem reduzir** a cobertura de `modules/ministry`. Sem `skip`/`only`/`xfail`
sem justificativa no código (CLAUDE.md).

---

## Fora de escopo

- Daily no `adm.fonte`.
- Servo em mais de um ministério pelo board (decisão 2).
- Trocar líder de ministério, criar/renomear/excluir ministério pelo board.
- Ordenação manual dentro da caixa (decisão 13).
- Edição offline / outbox da daily (decisão 11).
- Presença ("quem está na daily agora"), cursor/realce de quem está arrastando.
- Histórico navegável de dailies anteriores (ficam no banco como `APPLIED`/`DISCARDED`).
- Notificar filhos/servos da nova designação.
