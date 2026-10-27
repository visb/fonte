# Plan: ocorrência com múltiplos filhos envolvidos

## Context

Bloco do BACKLOG: "no app ops, nova ocorrência" (itens 226–230 refinam o mesmo formulário).

Hoje uma ocorrência tem no máximo **um** filho (`incidents.resident_id`, nullable) e o
`ResidentPicker` do ops é seleção única. Na prática, briga, fuga ou atitude positiva em grupo
envolve vários filhos — o operador registra só um ou repete a ocorrência.

Decisões travadas (refino com o usuário):

- **1 ocorrência, N filhos.** Tabela de junção; uma descrição só, aparece na ficha de cada
  filho envolvido. Descartado "uma ocorrência por filho" (duplica lista e notificações).
- **Ficha do filho mostra todos os envolvidos** (só staff vê o ops; contexto completo ajuda).
  Exibição na ficha é a story 228.
- **Compatibilidade com `residentId` legado:** APKs antigos em campo e itens já parados na fila
  offline (`incidents/create`) mandam `residentId`. Backend aceita os dois durante a transição:
  `residentId` vira `[residentId]`. Mandar os dois → união sem duplicata.
- Nenhum filho continua permitido (ocorrência da casa, sem filho).
- Hoje não há consumo de incidents no `adm.fonte` nem no `app.fonte` — só ops.

Dependências: nenhuma. A story 228 (ocorrências na aba Acompanhamento) depende desta.

## Desenho

### Backend (`services/api/src/modules/incident`)

- Migration nova:
  - `incident_residents (incident_id uuid FK incidents, resident_id uuid FK residents,
    created_at)`, PK composta `(incident_id, resident_id)`, índice em `resident_id`.
  - Backfill: `INSERT ... SELECT id, resident_id FROM incidents WHERE resident_id IS NOT NULL`.
  - Drop de `incidents.resident_id` (com `down` recriando a coluna e repopulando com o primeiro
    filho da junção).
- Entity: `Incident.residents: Resident[]` via `@ManyToMany` + `@JoinTable({ name: 'incident_residents' })`.
  Remover `residentId`/`resident`.
- `CreateIncidentDto`: `residentIds?: string[]` (`@IsArray`, `@IsUUID('4', { each: true })`,
  `@ArrayUnique`) + `residentId?: string | null` legado (`@IsOptional @IsUUID`), marcado
  deprecated no comentário.
- Service:
  - `create`: normaliza `residentIds ∪ [residentId]`, valida que todos existem e pertencem à
    `houseId` da ocorrência (`BadRequestException` com mensagem pt-BR se não).
  - `findAll(houseId?, residentId?)`: filtro por filho via join (`innerJoin` só para filtrar +
    carregar **todos** os residentes da ocorrência, não só o filtrado).
  - Notificação: `metadata.residentIds` (array) no lugar de `residentId`.
- Response: `residents: { id, name }[]`.
- Postman (`fonte-api.postman_collection.json`): body de `POST /incidents` com `residentIds`,
  exemplo de response atualizado.

### Contratos

- `packages/types` / `packages/api-client`: `CreateIncidentInput.residentIds?: string[]`,
  `Incident.residents: { id: string; name: string }[]`; remover `residentId`/`resident` do tipo
  de leitura. `pnpm build:types` + `pnpm build:api-client`.

### ops.fonte

- `ResidentPicker` → multi-seleção (`ResidentMultiPicker`): lista com checkbox, chips dos
  selecionados com "x" para remover. Campo do form `residentIds: string[]` (default `[]`),
  label "Filhos envolvidos (opcional)".
- `NewIncidentPage`: payload `residentIds`; nomes para o otimista (`residentNames`).
- Fila offline (`lib/offline/mutationDefaults.ts`): `applyIncident` monta `residents` a partir
  de `residentIds`/nomes. Item legado na fila (com `residentId`) continua replayando — o backend
  aceita.
- `IncidentCard`: "Filhos: A, B, C" (truncar com "+N" se passar de 3).

## Validação

- **Unit API (jest):** `incident.service.spec.ts` — cria com 0, 1 e N filhos; `residentId`
  legado; legado + array com sobreposição (sem duplicata); filho de outra casa → 400; filho
  inexistente → 400; `findAll` por `residentId` traz a ocorrência com **todos** os filhos;
  notificação com `residentIds`. DTO: array com não-UUID e duplicata → inválido.
- **Migration:** `migration:run:test` sobe e o backfill preserva o filho de ocorrências
  existentes; `down` volta.
- **E2E API:** `test/incident*.e2e-spec.ts` — POST com `residentIds`, GET `?residentId=` filtra.
  Fixtures próprias, limpeza por id (story 182).
- **Unit ops:** `ResidentMultiPicker` (seleciona, desmarca, remove chip); `IncidentCard` com 0/1/N
  filhos e "+N"; `mutationDefaults.test.ts` — otimista com N filhos e replay de variável legada
  com `residentId`.
- **E2E ops (Maestro):** `incidents.yaml` seleciona 2 filhos e confere no card.
- **Gate de cobertura:** código novo sem teste não fecha a story. `pnpm test:api:cov` +
  `pnpm test:ops:unit` com cobertura (≥90% do escopo tocado). `pnpm test:api` e
  `pnpm test:api:e2e` verdes. Sem `skip`/`only`/`xfail` injustificado.

## Fora de escopo

- Exibir ocorrências na aba Acompanhamento do filho (story 228).
- Editar ocorrência / mudar filhos depois de criada (Incident não é editável hoje).
- Remover o campo `residentId` legado do DTO — fica para quando nenhum APK antigo estiver em campo.
