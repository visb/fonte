# Plan: categoria da ocorrência (lista por tipo + "Outros")

## Context

Bloco do BACKLOG: "no app ops, nova ocorrência" (itens 226–230 refinam o mesmo formulário).

Ocorrência hoje é só texto livre — impossível saber, sem ler uma a uma, quantas foram briga,
evasão ou destaque positivo. Uma categoria padronizada dá leitura rápida na ficha do filho e
abre caminho para relatórios.

Decisões travadas (refino com o usuário):

- **Enum fixo no código** (mudar a lista = deploy). Descartado tabela gerenciada no adm —
  escopo maior e exigiria sync offline da lista.
- **Lista depende do tipo** (story 229): 👎 mostra só negativas, 👍 só positivas; `OTHER`
  ("Outros") existe nas duas e é sempre a última. Trocar o tipo no form limpa a categoria.
- **"Outros" não abre campo de texto** — a descrição da ocorrência já explica.
- **Obrigatória** em ocorrência nova. Ocorrências antigas ficam `category = null`
  ("Sem categoria" na exibição).
- Lista aprovada:

  | Tipo | Valor | Label |
  |---|---|---|
  | NEGATIVE | `AGGRESSION` | Agressão/briga |
  | NEGATIVE | `DISRESPECT` | Desrespeito/desobediência |
  | NEGATIVE | `EVASION` | Evasão ou tentativa |
  | NEGATIVE | `SUBSTANCE_USE` | Uso de substância |
  | NEGATIVE | `ACTIVITY_REFUSAL` | Recusa de atividade/ministério |
  | NEGATIVE | `PROPERTY_DAMAGE` | Dano ao patrimônio |
  | NEGATIVE | `HEALTH` | Saúde/mal-estar |
  | POSITIVE | `GOOD_BEHAVIOR` | Bom comportamento |
  | POSITIVE | `HELPING_OTHERS` | Ajuda ao próximo |
  | POSITIVE | `ACTIVITY_HIGHLIGHT` | Destaque em atividade/ministério |
  | POSITIVE | `SPIRITUAL_LIFE` | Vida espiritual |
  | POSITIVE | `TREATMENT_PROGRESS` | Superação/progresso no tratamento |
  | ambos | `OTHER` | Outros |

- **Compatibilidade com payload legado:** mesma regra da 229 — APK antigo / item parado na fila
  offline não manda `category`. Payload legado (com `severity`, sem `type`) é aceito e grava
  `category = null`. Payload novo (com `type`) sem `category` → 400.

Dependências: **depende da story 229** (campo `type`). Afeta a 228: `IncidentTrackingItem` e
`IncidentCard` passam a mostrar a categoria — quem implementar por último ajusta.

## Desenho

### Contratos (`packages/types`)

- `enum IncidentCategory` com os valores acima.
- `INCIDENT_CATEGORIES_BY_TYPE: Record<IncidentType, IncidentCategory[]>` (ordem de exibição,
  `OTHER` por último) — **fonte única** usada pelo backend (validação) e pelo ops (opções).
- Labels pt-BR ficam no app (`INCIDENT_CATEGORY_LABELS` em `features/incidents/constants.ts`);
  o contrato não carrega texto de UI.
- `api-client`: `Incident.category: IncidentCategory | null`, `CreateIncidentInput.category`.
- `pnpm build:types` + `pnpm build:api-client`.

### Backend (`services/api/src/modules/incident`)

- Migration nova: enum `incident_category`, coluna `incidents.category incident_category NULL`
  (sem backfill). `down` dropa coluna e enum.
- Entity: `category: IncidentCategory | null`.
- `CreateIncidentDto`: `category?: IncidentCategory` (`@IsEnum`, exigida via `@ValidateIf` quando
  `type` vier — mesma lógica de legado da 229).
- Service `create`: se `category` não pertence a `INCIDENT_CATEGORIES_BY_TYPE[type]` →
  `BadRequestException` ("Categoria não combina com o tipo da ocorrência").
- Postman: body de `POST /incidents` com `category`, response com o campo.

### ops.fonte

- `IncidentCategoryPicker` (`features/incidents/components/`): select (modal com lista, padrão
  dos pickers do app) filtrado por `type`; desabilitado com dica "Escolha positiva ou negativa
  primeiro" enquanto não há tipo.
- Form: `category` obrigatória no zod (`'Escolha a categoria'`), refinamento de coerência com
  `type`; `watch('type')` + `setValue('category', undefined)` ao trocar tipo.
- `IncidentCard`: label da categoria junto do badge de tipo; `null` → "Sem categoria".
- Fila offline: `applyIncident` otimista leva `category`.

## Validação

- **Unit types:** `INCIDENT_CATEGORIES_BY_TYPE` cobre todo valor do enum, `OTHER` nos dois tipos
  e por último, nenhuma categoria (exceto `OTHER`) nos dois.
- **Unit API (jest):** DTO com `ValidationPipe` (`forbidNonWhitelisted`): novo sem categoria →
  400; categoria inválida → 400; legado sem categoria → 201 com `null`. Service: categoria
  incoerente com tipo → 400; `OTHER` aceito nos dois tipos.
- **Migration:** `migration:run:test` — antigas ficam `null`; `down` volta.
- **E2E API:** `test/incidents.e2e-spec.ts` (+ `idempotency.e2e-spec.ts` se o payload mudar)
  com categoria; caso incoerente → 400. Fixtures próprias, limpeza por id (story 182).
- **Unit ops:** `IncidentCategoryPicker` (filtra por tipo, desabilitado sem tipo, `OTHER` por
  último); form limpa categoria ao trocar tipo e exige categoria; `IncidentCard` com categoria e
  "Sem categoria"; `mutationDefaults.test.ts` / `fieldFlows.test.tsx` com `category`.
- **E2E ops (Maestro):** `incidents.yaml` escolhe tipo + categoria e confere no card.
- **Gate de cobertura:** código novo sem teste não fecha a story. `pnpm test:api:cov` +
  `pnpm test:ops:unit` com cobertura (≥90% do escopo tocado). `pnpm test:api` e
  `pnpm test:api:e2e` verdes. Sem `skip`/`only`/`xfail` injustificado.

## Fora de escopo

- Gerenciar categorias pelo adm.
- Texto livre para "Outros".
- Filtro/relatório por categoria.
- Recategorizar ocorrências antigas.
