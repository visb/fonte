# Plan: Preferências do usuário — mecanismo geral + filtros da listagem de filhos

> **Status: PLANEJAMENTO.** Implementar só após aprovação do usuário.

## Context

Hoje nada do que o usuário configura na tela sobrevive ao reload: os filtros da listagem de filhos
vivem só na URL (commit `3e57442`) e voltam ao padrão a cada visita. Quem usa a lista o dia todo
refaz os mesmos filtros toda vez.

Esta story cria um **mecanismo geral de preferências por usuário** (não uma gambiarra só para essa
tela) e o usa no primeiro caso real: os filtros da listagem de filhos.

### Estado atual

- **Não existe** entidade nem módulo de preferências no backend.
- `AuthContext` (`apps/adm.fonte/src/contexts/`) já guarda o token no `localStorage` no login e o
  remove no logout — é onde a carga/limpeza das preferências se pluga.
- `ResidentsPage` lê os filtros da URL (`q`, `status`, `house`, `overdue`) e distingue
  **ausente** (`status` → default "Ativo") de **presente-e-vazio** (`status=` → "Todos"), via
  `searchParams.has('status')`. Essa distinção precisa continuar valendo.

### Decisões travadas

1. **Chave-valor por usuário:** `user_preferences(user_id, key, value jsonb)`, único por
   `(user_id, key)`. É o que faz dele um mecanismo **geral**: tela nova cria a própria chave sem
   migration, e salvar uma tela não reescreve as preferências das outras (o que um blob único por
   usuário faria em gravações concorrentes).
2. **Chave livre e validada por formato, sem whitelist por tela.** `key` casa
   `^[a-z][a-z0-9.]{0,63}$` (ex: `residents.filters`). Whitelist por chave obrigaria mudar o backend
   a cada tela nova — o oposto de mecanismo geral. `value` é JSON com **limite de tamanho** (4 KB)
   para não virar depósito.
3. **`user_id` sempre do JWT, nunca de parâmetro.** Não existe rota para ler/escrever preferência de
   outro usuário. Mesmo princípio do escopo por casa da listagem (`resident.service.ts:115-121`).
4. **A preferência hidrata a URL.** Abrir `/residents` sem filtro reescreve a URL (`replace`) com os
   filtros salvos. A URL segue sendo a verdade única da tela: o que se vê é o que se copia.
5. **URL com filtro vence por inteiro — e não é sobrescrita.** Se a URL trouxer **qualquer** um dos
   filtros, a preferência é ignorada *na íntegra* e nada é hidratado. Não é mesclagem chave a chave:
   o commit `3e57442` existe para **abrir a lista por link**, e mesclar faria o mesmo link mostrar
   listas diferentes conforme as preferências de quem abre. Link compartilhado tem que ser
   determinístico.
6. **Busca (`q`) nunca é preferência** — só URL, como pedido. Salvar busca faria o usuário voltar
   para uma lista filtrada por um texto que ele não lembra ter digitado.
7. **Gravação automática a cada mudança** (debounced). Mexeu no filtro, salvou — nos dois lugares
   (banco e `localStorage`). Trade-off aceito: filtrar por uma casa fixa aquilo como padrão até
   mudar de novo.
8. **`localStorage` é cache, o banco é a fonte.** No login, busca do servidor e popula o
   `localStorage`; a tela lê do `localStorage` (síncrono, sem piscar no primeiro render).
9. **Logout limpa as preferências do `localStorage`.** Máquina compartilhada é o normal na casa —
   sem isso o próximo usuário herdaria os filtros do anterior.
10. **Chave `residents.filters` guarda `{ status, house, overdue, sort }`** — inclui a ordenação da
    [[129]], que é escolha de exibição como as demais.

### Dependências

- **[[129]]** (ordenação) — `sort` só existe na URL depois dela. Fazer a 129 antes; esta story pluga
  memória no que já estiver lá.

## Desenho

### Backend (`services/api`) — módulo novo `preference`

**Migration** nova (`<timestamp>-UserPreferences.ts`):

```
user_preferences
  id         uuid pk default gen_random_uuid()
  user_id    uuid not null → users(id) on delete cascade
  key        varchar(64) not null
  value      jsonb not null
  created_at / updated_at
  unique (user_id, key)
```

`ON DELETE CASCADE`: preferência não sobrevive ao usuário (higiene LGPD — dado sem titular).

**Entity** `UserPreference` + `PreferenceModule` (controller + service + `forFeature`).

**Endpoints** (qualquer usuário autenticado — preferência é de quem está logado, decisão 3):

- `GET /preferences` → `Record<string, unknown>` (mapa chave→valor do usuário do token). Formato de
  mapa porque é exatamente o que vai para o `localStorage`.
- `PUT /preferences/:key` body `{ value: <json> }` → **upsert** (`ON CONFLICT (user_id, key) DO
  UPDATE`), idempotente.
- `DELETE /preferences/:key` → remove (reset ao padrão); 204 mesmo se não existia (idempotente).

**DTO**: `key` com `@Matches(/^[a-z][a-z0-9.]{0,63}$/)`; `value` obrigatório, rejeitado acima de 4 KB
(decisão 2).

**Postman**: adicionar os 3 endpoints.

### Contratos

- `packages/types`: `UserPreferences = Record<string, unknown>`; chave `residents.filters` tipada
  como `ResidentsFiltersPreference { status, house, overdue, sort }`.
- `api-client`: `preferences.getAll()`, `preferences.set(key, value)`, `preferences.remove(key)`.

### Frontend (`adm.fonte`)

**`lib/preferences.ts`** — acesso ao cache: `readPreferences()`, `readPreference<T>(key)`,
`writePreferenceCache(key, value)`, `clearPreferences()`. Chave única no `localStorage`
(`fonte.preferences`).

**`AuthContext`**: no login bem-sucedido, `preferences.getAll()` → popula o cache (decisão 8); no
logout, `clearPreferences()` (decisão 9). Falha ao buscar preferências **não** bloqueia o login — a
tela cai no padrão.

**`features/preferences/hooks/usePreference.ts`**: `usePreference<T>(key, defaultValue)` → `[value,
setValue]`. Lê do cache no primeiro render; `setValue` grava no cache **e** dispara
`preferences.set` (debounced) — os dois lados da decisão 7.

**`ResidentsPage`**:

- No mount: se a URL **não** tem nenhum de `status`/`house`/`overdue`/`sort`, hidrata a URL com
  `residents.filters` via `setSearchParams(..., { replace: true })` (decisão 4). Se tem **qualquer
  um**, não hidrata nada (decisão 5). `q` fica de fora dos dois lados (decisão 6).
- A cada mudança de filtro/ordenação, além do `setParam` atual, chama o `setValue` da preferência.
- A distinção **ausente vs presente-e-vazio** do `status` continua: a preferência guarda a string
  como está (`''` = "Todos") e a hidratação a reescreve na URL do mesmo jeito.

## Validação

- **`pnpm test:api`** (unit `PreferenceService`):
  - `getAll` devolve **só** as preferências do usuário do token (usuário B não enxerga as de A —
    decisão 3);
  - `set` cria e, na segunda chamada com a mesma chave, **atualiza sem duplicar** (upsert/unique);
  - `remove` apaga; remover inexistente não estoura;
  - chave fora do formato → rejeitada; `value` acima de 4 KB → rejeitado (decisão 2).
- **`pnpm test:api:e2e`** (`test/preferences.e2e-spec.ts` novo):
  - ciclo `PUT` → `GET` → `DELETE` → `GET` (some);
  - **401** sem token;
  - **isolamento**: token do usuário A não lê nem escreve preferência do usuário B;
  - **400** para chave inválida (ex: `../../etc`).
- **`pnpm test:adm:unit`**:
  - `lib/preferences`: read/write/clear no `localStorage`; `readPreference` devolve default quando
    não há cache ou o JSON está corrompido (não pode quebrar a tela).
  - `AuthContext`: login popula o cache; **logout limpa** (decisão 9); falha do `getAll` não impede o
    login.
  - `usePreference`: lê do cache no 1º render; `setValue` grava no cache **e** chama a API (debounced).
  - `ResidentsPage`: URL vazia + preferência salva → **URL hidratada** com os filtros salvos
    (decisão 4); URL com **um** filtro → preferência **ignorada por inteiro** e URL intacta
    (decisão 5); `q` na preferência nunca é gravado nem hidratado (decisão 6); trocar filtro grava a
    preferência; `status=''` salvo → hidrata como presente-e-vazio ("Todos"), não como ausente
    ("Ativo") — regressão da distinção atual.
- **`pnpm test:adm`** (Playwright): filtrar a lista → recarregar sem parâmetros na URL → filtros
  voltam; abrir link com filtro diferente → link vence; logout/login com **outro** usuário → filtros
  do primeiro **não** aparecem.
- **`pnpm build:types && pnpm build:api-client`** (contratos) e **`pnpm --filter api
  migration:run:test`** (migration nova aplica limpa).

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` + `pnpm test:adm:unit:cov`; **não
reduzir** a cobertura do módulo `preference` nem de `features/residents`, `features/preferences` e
`contexts/`. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- **Preferências em outras telas** (staff, associados, eventos, dashboard) — o mecanismo fica pronto;
  cada tela adota quando for tocada.
- Preferências no `ops.fonte`/`app.fonte` — a API é genérica e serve aos dois, mas a adoção não entra
  aqui.
- Preferências de **aparência** (tema, densidade, idioma) ou de notificação.
- Preferências **por casa ou globais do sistema** (configuração administrativa) — isto é por usuário.
- Sincronizar preferência entre abas abertas (evento `storage`) ou entre dispositivos em tempo real.
- Botão "salvar filtros como padrão" — decisão 7 fixou gravação automática.
- Migrar/reaproveitar filtros que o usuário já tenha na URL hoje (não há o que migrar — nada é
  persistido).
