# Plan: ocorrência com tipo positivo/negativo (substitui severidade)

## Context

Bloco do BACKLOG: "no app ops, nova ocorrência" (itens 226–230 refinam o mesmo formulário).

Hoje toda ocorrência é implicitamente negativa e carrega `severity` obrigatória
(`LOW | MEDIUM | HIGH | CRITICAL`, seletor `SeveritySelector`). A casa quer registrar também
fatos **positivos** (atitude exemplar, ajuda a outro filho) — o acompanhamento do filho não pode
ser só lista de problemas.

Decisões travadas (refino com o usuário):

- Campo **tipo** com 2 valores: `POSITIVE` (ícone 👍 / `thumbs-up`) e `NEGATIVE`
  (👎 / `thumbs-down`).
- **Severidade é removida** do produto — o tipo substitui. Sai do formulário, do card, dos
  contratos e do banco.
- **Sem default no formulário:** tipo obrigatório, o operador escolhe conscientemente.
- Ocorrências existentes viram `NEGATIVE` no backfill (todas foram registradas como problema).
  A severidade histórica **é descartada** com o drop da coluna (o `down` da migration recria a
  coluna com `MEDIUM`).
- **Compatibilidade com payload legado:** o `ValidationPipe` global roda com
  `forbidNonWhitelisted: true`, e APKs antigos em campo + itens já parados na fila offline
  (`incidents/create`) mandam `severity` e **não** mandam `type`. Sem tratamento, o replay
  tomaria 400 e cairia na tela de pendências. Então o DTO:
  - mantém `severity?` como campo aceito e **ignorado** (deprecated);
  - aceita `type` ausente **somente** quando `severity` veio (payload legado) → grava `NEGATIVE`;
  - sem `type` e sem `severity` → 400 ("Informe se a ocorrência é positiva ou negativa").

Dependências: nenhuma de ordem obrigatória com 226/227. **Afeta a 228:** o
`IncidentTrackingItem` usa ícone/cor do **tipo** (👍 verde / 👎 vermelho) em vez da severidade —
quem implementar por último ajusta.

## Desenho

### Backend (`services/api/src/modules/incident`)

- Migration nova: enum `incident_type` (`POSITIVE`, `NEGATIVE`), coluna
  `incidents.type incident_type NOT NULL` (add com default `NEGATIVE` para backfill, depois
  remover o default), drop de `incidents.severity` e do enum de severidade. `down` reverso
  (recria `severity` = `MEDIUM`, dropa `type`).
- Entity: `type: IncidentType`; remover `severity`.
- `CreateIncidentDto`: `type?: IncidentType` (`@IsEnum`, `@ValidateIf(o => o.severity === undefined)`
  para exigir quando não for legado) + `severity?: string` deprecated (`@IsOptional`, ignorado).
- Service `create`: `type = dto.type ?? IncidentType.NEGATIVE` (só alcançável no legado);
  nunca persiste `severity`.
- Notificação `INCIDENT_CREATED`: título conforme tipo ("Nova ocorrência positiva/negativa").
- Postman: body de `POST /incidents` com `type`, response sem `severity`.

### Contratos

- `packages/types`: `enum IncidentType { POSITIVE, NEGATIVE }`; remover `IncidentSeverity`.
- `packages/api-client`: `Incident.type`, `CreateIncidentInput.type`; sem `severity`.
- `pnpm build:types` + `pnpm build:api-client`.

### ops.fonte

- `IncidentTypeSelector` (substitui `SeveritySelector`, que é removido): dois botões grandes lado
  a lado, `thumbs-up-outline` verde "Positiva" / `thumbs-down-outline` vermelho "Negativa",
  estado selecionado preenchido. Acessível (`accessibilityRole="radio"`, `accessibilityState`).
- Schema zod: `type: z.nativeEnum(IncidentType, { required_error: 'Escolha positiva ou negativa' })`,
  sem default; erro exibido.
- `lib/constants.ts`: `SEVERITY_CONFIG` → `INCIDENT_TYPE_CONFIG` (label, ícone, cor).
- `IncidentCard`: badge com ícone + "Positiva"/"Negativa".
- Botão "Registrar ocorrência": cor neutra (hoje vermelho fixo — não combina com positiva).
- Fila offline: `applyIncident` otimista usa `type`. Item legado na fila (com `severity`) replaya
  e o backend resolve como `NEGATIVE`.

## Validação

- **Unit API (jest):** `incident.service.spec.ts` + spec do DTO com `ValidationPipe`
  (`whitelist` + `forbidNonWhitelisted`): `type` POSITIVE/NEGATIVE ok; sem `type` e sem
  `severity` → 400; legado (`severity` sem `type`) → 201 com `NEGATIVE`; `type` + `severity`
  → usa `type`; `type` inválido → 400. Título da notificação por tipo.
- **Migration:** `migration:run:test` — ocorrências existentes ficam `NEGATIVE`; `down` volta.
- **E2E API:** atualizar `test/incidents.e2e-spec.ts` e `test/idempotency.e2e-spec.ts` (usam
  `severity`) + caso de payload legado. Fixtures próprias, limpeza por id (story 182).
- **Unit ops:** `IncidentTypeSelector` (seleção, estado acessível); form sem tipo → erro;
  `IncidentCard` por tipo; `fieldFlows.test.tsx`, `mutationDefaults.test.ts`,
  `useIncidents.test.tsx`, `IncidentComponents.test.tsx` migrados de `severity` para `type`.
- **E2E ops (Maestro):** `incidents.yaml` escolhe 👍/👎 e confere badge no card.
- **Gate de cobertura:** código novo sem teste não fecha a story. `pnpm test:api:cov` +
  `pnpm test:ops:unit` com cobertura (≥90% do escopo tocado). `pnpm test:api` e
  `pnpm test:api:e2e` verdes. Sem `skip`/`only`/`xfail` injustificado.

## Fora de escopo

- Filtrar a lista de ocorrências por tipo.
- Métricas/contagem de positivas × negativas no dashboard.
- Remover o campo `severity` legado do DTO — fica para quando nenhum APK antigo estiver em campo.
- Categoria (story 230).
