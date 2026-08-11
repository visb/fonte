# Plan: backend — snapshot offline da casa (agregado + delta)

> Pré-requisito de [[175]]. Entra **antes**: sem este endpoint, o aquecimento da 175 nasce com
> `1 + N×4` requests e teria de ser reescrito depois.

## Context

A [[175]] põe a ficha completa de todos os filhos da casa no aparelho (SQLite, sem expiração). Com
os endpoints atuais, aquecer uma casa custa, **a cada login e a cada volta do foreground**:

| requests | de onde |
|---|---|
| 1 | `GET /residents/by-house/:id` |
| N | `GET /residents/:id` |
| N | `GET /residents/:id/follow-ups` |
| N | `GET /residents/:id/attachments` |
| N | `GET /consents/status/RESIDENT/:id` |
| N | financeiro (`receivables`) |
| 1 | ministérios da casa |

Casa de 40 filhos ≈ **200 requests**. Não bate em rate limit (o `ThrottlerGuard` não é `APP_GUARD` —
`app.module.ts:63` registra o módulo, mas o guard só está em login e nos controllers públicos), então
o sintoma não é 429: é bateria, dados móveis e minutos de espera em rede ruim — exatamente o cenário
do ops.fonte. E, pior, **tudo é rebaixado inteiro toda vez**: nenhuma rota de resident aceita
`updatedSince`/`If-Modified-Since`.

### Decisões travadas (usuário)

1. **Endpoint agregado com delta**: `GET /houses/:houseId/offline-snapshot?since=<ISO>` devolve, num
   payload só, o pacote offline da casa — e, com `since`, **apenas o que mudou**.

```jsonc
{
  "syncedAt": "2026-08-11T09:12:03Z",
  "full": false,
  "residents": [ /* ... */ ],
  "followUps":   { "<residentId>": [ /* ... */ ] },
  "consents":    { "<residentId>": [ /* ... */ ] },
  "receivables": { "<residentId>": [ /* ... */ ] },
  "attachments": { "<residentId>": [ /* ... */ ] },
  "ministries":  [ /* ... */ ],
  "deleted": { "residents": ["id"], "followUps": ["id"], "receivables": ["id"] }
}
```

2. **Só filhos presentes na casa** (`PRESENT_RESIDENT_STATUSES` de `@fonte/types`). Quem saiu ou foi
   arquivado não vai para o aparelho — menos payload e menos dado pessoal parado no dispositivo,
   o que alivia o gap LGPD que a [[175]] abre.
3. **Backend primeiro**: esta story entra antes da [[175]], que passa a consumir o snapshot em vez
   de fazer o fan-out.

### Decisões de desenho derivadas (do levantamento no schema)

4. **`consent_records` é append-only** e só tem `created_at` (por desenho: cada concessão/revogação
   é uma linha nova, é prova documental — `consent-record.entity.ts`). Delta de consentimento filtra
   por `created_at > since`; consentimento **nunca** entra em `deleted`.
5. **`resident_attachments` não tem `deleted_at`** (só `created_at`). Remoção de anexo, portanto,
   **não é detectável por delta**. Travado: no delta, `attachments` vem com o **conjunto completo**
   do filho sempre que aquele filho aparece no payload (é metadado, custo baixo); anexo removido de
   um filho que não mudou só some na próxima sincronização completa. Adicionar `deleted_at` à
   tabela fica fora desta story.
6. **Sincronização completa periódica**: sem `since`, ou com `since` mais velho que
   `SNAPSHOT_MAX_DELTA_AGE` (30 dias), a resposta vem `full: true` com tudo — é o reconciliador que
   fecha os buracos das decisões 4 e 5. O cliente ([[175]]) troca o conteúdo do store em vez de
   fazer merge quando `full` é `true`.
7. **`syncedAt` é o relógio do servidor** e é o que o cliente guarda para o próximo `since`. Nunca o
   relógio do aparelho — celular em campo com hora errada perderia atualização em silêncio.
   Aplicar uma folga (`syncedAt = now - 1s`) para não perder escrita concorrente com a leitura.

### Trade-offs / cuidados

- **Módulo novo, não puxadinho no `resident`.** O snapshot cruza cinco módulos; agregar dentro do
  `ResidentService` violaria "services dependem de outros módulos via contrato claro" (CLAUDE.md).
- **Payload passa pelos interceptors globais.** `SensitiveDataInterceptor` (mascara CPF/RG) e
  `StorageUrlInterceptor` (resolve URL de storage) são `APP_INTERCEPTOR` — o snapshot sai
  mascarado e com URL resolvida igual às rotas individuais. Teste amarra isso: dado sensível não
  pode vazar em claro por caminho novo.
- **Autorização é a parte perigosa.** Um endpoint que despeja a casa inteira é o alvo óbvio. Só
  staff **da própria casa** (`staff.houseId === :houseId`) ou `ADMIN`. `RELATIVE` e `RESIDENT`:
  403. Sem esse guard o endpoint vira vazamento de base inteira.
- **Custo em banco**: consultas por `updated_at > since` precisam de índice. Migration nova com
  índice em `(house_id, updated_at)` de `residents` e em `(resident_id, updated_at)` das tabelas
  filhas — sem isso o delta é seq scan a cada foreground.
- Rotas individuais **continuam existindo** (o `adm.fonte` e as telas de detalhe usam). Esta story
  adiciona, não substitui.

## Desenho

### 1. Módulo — `services/api/src/modules/offline-sync/`

- `offline-sync.module.ts` — importa `ResidentModule`, `ResidentFollowUpModule`,
  `ResidentReceivableModule`, `ConsentModule`, `MinistryModule` e consome os **services** deles.
- `offline-sync.controller.ts` — `GET /houses/:houseId/offline-snapshot`; valida `houseId` (UUID) e
  `since` (ISO 8601) via DTO + `class-validator`; sem regra de negócio.
- `offline-sync.service.ts` — monta o snapshot:
  1. filhos presentes da casa (`PRESENT_RESIDENT_STATUSES`), filtrados por `updated_at > since`
     quando delta;
  2. ids dos filhos presentes → busca em lote (`IN (...)`, **uma query por recurso**, nunca N+1)
     de follow-ups, receivables, contribuições, consents e attachments;
  3. ministérios da casa;
  4. `deleted`: linhas com `deleted_at > since` (residents, followUps, receivables) + filhos que
     saíram de `PRESENT_RESIDENT_STATUSES` desde `since` — o app precisa **remover** do store quem
     deixou a casa, senão o dado sobrevive lá para sempre;
  5. `syncedAt` do servidor com a folga da decisão 7.
- `dto/offline-snapshot-query.dto.ts` e o tipo de resposta.

### 2. Autorização

- Guard/decorator de role já existente + checagem explícita `staff.houseId === houseId` no service
  (ADMIN passa por cima). Coordenador sem casa (servo de grupo de apoio) não tem snapshot: 403.

### 3. Migration

- Índices: `residents(house_id, updated_at)`, `resident_follow_ups(resident_id, updated_at)`,
  `resident_receivables(resident_id, updated_at)`,
  `consent_records(subject_type, subject_id, created_at)`,
  `resident_attachments(resident_id)`. Migration nova — nenhuma existente é editada.

### 4. Contratos

- `packages/types`: `HouseOfflineSnapshot`, `OfflineSnapshotDeleted`.
- `packages/api-client`: `api.offlineSync.houseSnapshot(houseId, since?)`.
- `fonte-api.postman_collection.json`: entrada nova com as duas variantes (com e sem `since`).

## Validação

Story de backend + contratos. Nenhum app é tocado aqui (o consumo é a [[175]]).

### Testes obrigatórios

**Unit (`pnpm test:api`)** — `offline-sync.service.spec.ts`:

- **Full** (sem `since`): devolve todos os filhos presentes da casa com os cinco blocos de detalhe e
  os ministérios; `full === true`; `deleted` vazio.
- **Delta**: filho alterado depois de `since` aparece; filho intocado **não** aparece;
  `full === false`.
- **Filtro de status**: filho com status fora de `PRESENT_RESIDENT_STATUSES` não entra no payload,
  nem em `full` nem em delta.
- **`deleted`**: filho com `deleted_at > since` entra em `deleted.residents`; filho que saiu de
  `PRESENT_RESIDENT_STATUSES` depois de `since` também; follow-up e receivable apagados entram nas
  suas listas.
- **Consent (decisão 4)**: filtra por `created_at`; revogação (linha nova com `granted: false`)
  aparece no delta; nada de consent em `deleted`.
- **Attachments (decisão 5)**: conjunto completo do filho sempre que o filho aparece no payload.
- **`since` velho demais** (> `SNAPSHOT_MAX_DELTA_AGE`) → responde `full: true`.
- **`syncedAt`** vem do relógio do servidor, com a folga da decisão 7 (não é o `since` do cliente,
  não é `Date.now()` cru).
- **Sem N+1**: com N filhos, o número de chamadas ao repositório é constante (spies contam as
  queries) — é a razão de ser da story.
- **Casa sem filho presente**: payload válido e vazio, não erro.

**E2E (`pnpm test:api:e2e`)** — `offline-snapshot.e2e-spec.ts`:

- `SERVANT`/`COORDINATOR` da própria casa: 200 com o pacote;
- staff de **outra** casa: 403;
- servo de grupo de apoio (sem `houseId`): 403;
- `RESIDENT` e `RELATIVE`: 403;
- sem token: 401;
- `houseId` inválido: 400; `since` malformado: 400;
- CPF/RG vêm **mascarados** (prova de que os interceptors globais pegam a rota nova) e URL de foto
  vem resolvida;
- 200 com `since` recente devolve payload menor que o `full` do mesmo estado.

**Contratos**: `pnpm build:types` e `pnpm build:api-client` verdes; Postman atualizado
(endpoint novo → obrigatório por CLAUDE.md). Migration: `pnpm migration:run:test` aplica limpo.

### Gate de cobertura (trava a story)

> Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste.
> Rodar `pnpm test:api:cov`; **não reduzir** a cobertura dos módulos afetados
> (`offline-sync` nasce em ≥90%). Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Consumo do endpoint no app — é a [[175]].
- `deleted_at` em `resident_attachments` (decisão 5 assume o contorno).
- Push/websocket de invalidação — o app continua puxando no login e no foreground.
- Snapshot para servo de grupo de apoio, `app.fonte` (RELATIVE) ou `resident.fonte`.
- Compressão específica do payload (gzip do servidor já vale) e paginação do snapshot.
- Remover ou alterar as rotas individuais de resident.
