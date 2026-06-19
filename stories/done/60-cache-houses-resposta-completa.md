# Plan: Cache da resposta completa do GET /houses (Redis)

## Context

A story 59 introduziu Redis e cacheou **apenas** a contagem de filhos presentes por casa
(`house:resident-counts`). O endpoint `GET /houses` → `HouseService.findAll()` ainda roda,
a cada request, três consultas ao banco além da contagem cacheada:

- `houseRepository.find()` (lista de casas + coordenador),
- `GROUP BY house_id` em `staff` (`staffCount`),
- `DISTINCT ON (house_id)` em `house_photos` (`thumbnailUrl`).

Objetivo: **cachear a resposta inteira** do `findAll` (lista + `activeResidentsCount` +
`staffCount` + `thumbnailUrl`) numa única chave Redis, com invalidação inteligente em
todos os eventos que alteram esse payload.

### Eventos que invalidam o cache

1. **Mudança de filho (resident).** Já emite `RESIDENT_COUNTS_CHANGED_EVENT` em
   `create`/`update`/`readmit`/`remove`/`promoteToServant`. A **transferência de filho
   entre casas** acontece via `update` com `dto.houseId` alterado (resident.service.ts:283),
   então já está coberta por esse evento — não há endpoint de transferência separado.
2. **Mudança no registro da casa.** `HouseService.create`/`update`/`remove` e
   `addPhoto`/`removePhoto` alteram a lista, dados da casa e o `thumbnailUrl`. Hoje **não
   invalidam nada**.
3. **Mudança de staff.** `staffCount` faz parte da resposta; `StaffService.create`/`update`/
   `remove` mudam a contagem ou a lotação. Hoje **não invalidam nada**.

### Decisões travadas

- **Escopo = resposta do `GET /houses` (`findAll`).** O `findOne` (`GET /houses/:id`) **não**
  muda: segue lendo `getResidentCountsMap()` + query de staff ao vivo. Cachear o detalhe de
  casa é fora de escopo.
- **staffCount entra no cache e é invalidado em mudança de staff** (decisão do usuário).
  Nada de servir contagem de staff velha — correção > micro-otimização (mesma diretriz da 59).
- **Nova chave `house:list`** guarda o array completo do `findAll` (poucas casas, payload
  pequeno). Coexiste com `house:resident-counts`, que continua servindo o `findOne`.
- **TTL de segurança de 1h** (`RESIDENT_COUNTS_TTL` já existe; reusar a mesma constante de
  tempo), além da invalidação por evento — nunca prender valor por bug de invalidação.
- **Invalidação por dono direto + evento p/ módulos externos:**
  - `HouseService` é dono da chave → suas próprias mutações (`create`/`update`/`remove`/
    `addPhoto`/`removePhoto`) chamam `cache.del('house:list')` direto, sem evento.
  - `StaffService` está em outro módulo → emite `HOUSE_STAFF_CHANGED_EVENT`; `HouseService`
    escuta com `@OnEvent` e apaga `house:list`. Evita acoplar `StaffModule` ao cache de casas
    (mesmo padrão da 59 com `RESIDENT_COUNTS_CHANGED_EVENT`).
  - O handler existente de `RESIDENT_COUNTS_CHANGED_EVENT` passa a apagar **as duas** chaves
    (`house:resident-counts` **e** `house:list`), pois mudança de filho altera o
    `activeResidentsCount` dentro do payload cacheado.
- **Sobre-invalidar é aceitável.** Emitimos em qualquer mutação relevante sem checar se o
  valor realmente mudou — simplicidade e correção acima de micro-otimização.
- **Degradação graciosa** mantida: sem `REDIS_URL` o `CacheService` é no-op, tudo recalcula
  como hoje (já garantido pela 59).

## Desenho

### Novo evento — `common/events/house-staff.event.ts`

```ts
/** Emitido pelo StaffService quando staffCount/lotação muda; invalida o cache house:list. */
export const HOUSE_STAFF_CHANGED_EVENT = 'house.staff.changed';
```

### `HouseService` (`services/api/src/modules/house/house.service.ts`)

- Nova constante `RESIDENT_LIST_KEY = 'house:list'` (TTL reusa `RESIDENT_COUNTS_TTL`).
- `findAll`: no início, tenta `cache.get<...>('house:list')`; **hit** retorna direto. No
  **miss**, roda as consultas atuais (`Promise.all`), monta o array e grava com
  `cache.set('house:list', result, TTL)` antes de retornar.
  - Atenção à serialização: o array contém entidades `House` com relação `coordinator`.
    JSON round-trip transforma `Date` em string — verificar se o front consome OK (datas já
    trafegam como string no JSON da API; sem mudança de contrato). Documentar no teste.
- `invalidateResidentCounts()` (handler de `RESIDENT_COUNTS_CHANGED_EVENT`): passa a apagar
  **`house:resident-counts` e `house:list`**.
- Novo handler `@OnEvent(HOUSE_STAFF_CHANGED_EVENT) invalidateHouseList()` → `cache.del('house:list')`.
- `create`/`update`/`remove`/`addPhoto`/`removePhoto`: após a escrita, `cache.del('house:list')`.
  - Extrair helper privado `private async invalidateHouseList()` reusado por handler e mutações.

### `StaffService` (`services/api/src/modules/staff/staff.service.ts`)

- Injetar `EventEmitter2`.
- Emitir `HOUSE_STAFF_CHANGED_EVENT` ao fim de `create`, `update` e `remove`.
  (`updateMe` = perfil próprio, não muda `houseId`/lotação → não emite. `removePermission`
  tampouco.)

## Validação

- **Unit (Jest backend)** — `pnpm test:api`:
  - `HouseService.findAll`: **hit** não consulta o banco (mocka `cache.get` retornando array);
    **miss** consulta, monta e grava (`cache.set` chamado com `house:list`).
  - `HouseService`: `create`/`update`/`remove`/`addPhoto`/`removePhoto` chamam
    `cache.del('house:list')`.
  - `invalidateResidentCounts` apaga as duas chaves; `invalidateHouseList`/handler de
    `HOUSE_STAFF_CHANGED_EVENT` apaga `house:list`.
  - `StaffService`: `create`/`update`/`remove` emitem `HOUSE_STAFF_CHANGED_EVENT`; `updateMe`
    **não** emite. Atualizar o construtor no spec (novo `EventEmitter2`).
- **E2e (supertest)** — se já houver e2e de `GET /houses`, garantir que segue verde com o
  cache ligado/desligado (sem `REDIS_URL` no ambiente de teste = caminho no-op).
- Suíte tocada inteira verde (DoD epic 49).
- **Sem mudança de endpoint/contrato** → `fonte-api.postman_collection.json` não muda.

## Fora de escopo

- Cachear o `findOne` (`GET /houses/:id`) — segue ao vivo + `house:resident-counts`.
- Cache no frontend (React Query já cacheia client-side).
- Qualquer mudança de DTO/contrato/resposta da API.
- Invalidação granular por casa (chave única global do array é suficiente — poucas casas).
