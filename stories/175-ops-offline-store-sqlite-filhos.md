# Plan: ops.fonte — ficha dos filhos persistente em SQLite (offline sem prazo)

> Sucessora de [[167]] / [[168]] / [[171]]. Substitui o cache de filhos por um **store local de
> verdade**; não desmonta a outbox ([[169]]) nem a tela de pendências ([[170]]).

## Context

O offline-first do ops.fonte hoje é o cache do React Query desidratado num **blob único** de
AsyncStorage (`lib/offline/persister.ts`). Funciona para "abrir com dado", mas não entrega o que o
operador precisa em campo:

1. **`PERSIST_MAX_AGE = 24h`** (`lib/offline/constants.ts`): cache mais velho que um dia é
   descartado na reidratação. Casa sem sinal por um fim de semana → app abre **vazio**.
2. **Detalhe de filho só existe se já foi aberto.** `warmHouseCache` (`lib/offline/prefetch.ts`)
   aquece `residents.byHouse`, estoque, ocorrências de hoje e atividades — mas nunca
   `residents.detail(id)`. Quem entra na casa sem sinal vê a lista e não abre nenhuma ficha.
3. **Blob único não escala para N fichas.** Cada gravação reserializa o cache inteiro; a ficha de
   cada filho da casa multiplicada por acompanhamentos, consentimentos e financeiro derruba a
   janela de throttle de 1s.

O pedido é explícito: **a lista de filhos e os detalhes dela têm de estar no aparelho, de forma
persistente, sem conexão.**

### Decisões travadas (usuário)

1. **Store local em SQLite (`expo-sqlite`)**, não mais o blob do React Query, para o domínio de
   filhos. O React Query vira camada de fetch/estado de tela; a **fonte de verdade offline** é o
   banco local.
2. **Sem expiração por tempo.** O dado do filho vive no aparelho até **logout / sessão expirada**.
   Não há mais `maxAge` de 24h para esse domínio. A tela mostra "atualizado em &lt;data/hora&gt;" quando
   o dado é velho — o operador decide, o app não apaga por baixo dele.
3. **Escopo do "detalhe" é amplo**: ficha básica (`residents.detail`), acompanhamentos
   (`resident-follow-ups`), ministérios da casa (`useHouseMinistries`) **e**
   anexos/consentimentos/financeiro (`resident-attachments`, `resident-consents`,
   `resident-receivables`) — os três últimos estavam **fora** da allowlist de [[167]] por decisão
   LGPD e entram agora por decisão explícita do usuário (ver "Consequência LGPD").
4. **Aquecimento puxa a ficha de todos os filhos ativos da casa** no login e ao voltar do foreground —
   sem endpoint em lote novo no backend. N requests com **concorrência limitada**, não uma rajada.

### Trade-offs aceitos / consequências

- **Consequência LGPD (a mais pesada).** O aparelho passa a guardar, por tempo indeterminado, a
  ficha completa de todos os filhos da casa — incluindo consentimentos e financeiro. Isso muda o
  inventário: `docs/lgpd/DIAGNOSTICO_LGPD.md` precisa registrar o novo armazenamento local e sua
  base legal/retenção. Mitigações obrigatórias desta story: purga **completa e verificada** do banco
  local no logout e na sessão expirada; allowlist continua allowlist (nada entra por omissão);
  nenhum dado de outra casa é baixado.
- **Anexos: metadados sim, binário não.** Persistir a _lista_ de anexos (nome, tipo, data, id).
  Baixar os arquivos para o dispositivo fica **fora de escopo** — é volume de disco e exposição de
  documento que não foi pedido. A tela de anexo offline mostra a lista e avisa que o arquivo exige
  conexão. (A foto do filho segue o comportamento atual, servida pela URL já cacheada pelo
  `Image`.)
- **Web não tem SQLite.** O ops.fonte roda em web (Expo web, suíte `e2e-web/` do Playwright). O
  store é escrito atrás de uma **interface com dois drivers**: SQLite em nativo, AsyncStorage
  (uma chave por registro) em web. Semântica idêntica; o e2e web continua provando o
  comportamento offline.
- **Duplicidade de persistência.** Domínio de filho sai do `dehydrateOptions` do persister blob
  (senão o mesmo dado é gravado em dois lugares com prazos diferentes). O blob continua existindo
  para o resto da allowlist (estoque, despensa, ocorrências, atividades, venda de rua) — mexer
  nesses fluxos não é escopo desta story.
- **Sem mudança de backend, contrato ou Postman.** Story frontend-only, um app só.

## Desenho

### 1. Store local — `apps/ops.fonte/lib/offline/store/`

- `schema.ts` — DDL e versionamento. Tabelas:
  - `residents(id PK, house_id, payload TEXT, updated_at INTEGER)` — lista/ficha básica;
  - `resident_details(resident_id, kind, payload TEXT, updated_at INTEGER, PK(resident_id, kind))`
    com `kind ∈ {follow_ups, attachments, consents, receivables}`;
  - `house_ministries(house_id PK, payload TEXT, updated_at INTEGER)`;
  - `meta(key PK, value)` — versão do schema e carimbo do último sync.
  - `payload` é o JSON do tipo já compartilhado (`@fonte/types`); o store **não** remodela o
    contrato — indexa por id/casa e guarda o corpo.
- `driver.ts` — interface `ResidentStoreDriver` (`get`, `put`, `putMany`, `listByHouse`, `clearAll`)
  com implementações `driver.sqlite.ts` (`expo-sqlite`, nativo) e `driver.web.ts` (AsyncStorage,
  uma chave por registro, prefixo próprio). Seleção por `Platform.OS`.
- `migrations.ts` — `user_version` do SQLite; bump descarta e recria (dado é cache reconstruível,
  não há migração de conteúdo a preservar).
- `residentStore.ts` — API de domínio consumida pelos hooks: `saveResidentList(houseId, residents)`,
  `saveResidentDetail(id, kind, payload)`, `readResidentList(houseId)`, `readResidentDetail(id, kind)`,
  `lastSyncedAt(...)`, `purgeAll()`.

### 2. Integração com o React Query

- Hooks de `features/residents/hooks/` (`useResidents`, detalhe, `useResidentFollowUps`,
  `useResidentConsents`, `useProductContributions`, `useHouseMinistries`) ganham, sem mudar
  assinatura pública:
  - `initialData` / `initialDataUpdatedAt` vindos do store (leitura síncrona já hidratada no boot,
    ou `placeholderData` quando a leitura é assíncrona) — a tela abre com dado mesmo sem sinal e
    sem esperar a rede;
  - **write-through**: sucesso da query grava no store (`saveResident*`).
- `lib/offline/constants.ts`: prefixos do domínio de filho saem de `PERSISTED_QUERY_PREFIXES`
  (passam a viver no store) e ganham um teste que trava a não-duplicação.
- `lib/queryClient.ts`: `gcTime` do domínio de filho deixa de depender de `PERSIST_MAX_AGE`.

### 3. Aquecimento (`lib/offline/prefetch.ts`)

- `warmHouseCache` passa a: buscar `residents.byHouse` → para cada filho, buscar ficha + os quatro
  detalhes, com **pool de concorrência** (constante exportada, default 4) e falha individual
  tolerada (aquecimento é oportunista, como hoje).
- Resultado do aquecimento é escrito no store, não só no cache em memória.
- `WARM_STALE_TIME` continua evitando rajada a cada foreground.

### 4. Frescor visível

- Componente compartilhado de "atualizado em &lt;data/hora&gt;" (`components/shared/`) na lista e na
  ficha, alimentado por `lastSyncedAt`. Substitui a proteção que o `maxAge` dava: em vez de sumir
  com o dado velho, mostrar que ele é velho.

### 5. Purga (LGPD)

- `lib/auth.tsx`: logout e sessão expirada chamam `purgeAll()` do store junto de
  `clearPersistedCache()`. Falha na purga **não** pode ser silenciosa.
- `docs/lgpd/DIAGNOSTICO_LGPD.md`: registrar o armazenamento local no dispositivo (categorias,
  retenção "até logout", mitigação).

## Validação

Frontend-only, um app (`ops.fonte`). Backend, contratos e Postman não mudam.

### Testes obrigatórios

**Unit (`pnpm test:ops:unit`)** — casos a cobrir:

- `residentStore`: grava e lê lista por casa; grava e lê cada um dos quatro `kind` de detalhe;
  `putMany` é idempotente (regravar o mesmo id não duplica linha); `updated_at` avança;
  `readResidentList` de casa sem dado devolve vazio (não lança).
- `migrations`: `user_version` diferente → banco recriado vazio; igual → dado preservado.
- `driver.web` e `driver.sqlite` passam **na mesma bateria de contrato** (suite parametrizada pelos
  dois drivers) — é o que garante que o e2e web prova o comportamento do nativo.
- `purgeAll`: depois da purga, nenhuma leitura devolve dado; erro do driver na purga **propaga**
  (não engole).
- `constants`: prefixos de filho **não** estão mais em `PERSISTED_QUERY_PREFIXES` (trava
  duplicidade) e o restante da allowlist continua intacto; `isPersistableQueryKey` segue por
  igualdade de primeiro segmento.
- `prefetch`: aquece a ficha e os quatro detalhes de **cada** filho retornado; respeita o pool de
  concorrência (nunca mais que N requests em voo); falha de um filho não aborta os demais;
  `houseId` nulo não dispara nada; tudo que é aquecido é gravado no store.
- Hooks de residents: com store populado e rede caída, o hook devolve dado (`initialData`) e não
  erro; sucesso de rede faz write-through; `initialDataUpdatedAt` alimenta o "atualizado em".
- `auth`: logout chama `purgeAll` **e** `clearPersistedCache`.

**E2E web (`pnpm test:ops:e2e`, Playwright, `e2e-web/`)** — spec nova
`offline-resident-store.spec.ts`:

- login online → aquecimento → `context.setOffline(true)` → **reload** → lista de filhos aparece e
  a ficha de um filho abre com ficha básica, acompanhamentos, consentimentos e financeiro;
- offline com dado antigo: aparece "atualizado em ..." e o dado **não** é descartado (prova que o
  prazo de 24h acabou — simular relógio adiantado);
- logout offline → reload → nenhuma ficha de filho sobrevive (prova de purga LGPD);
- specs offline existentes (`offline.spec.ts`, `offline-field-flows`, `offline-outbox`,
  `offline-sync-screen`) continuam verdes — a outbox de [[169]]/[[170]] não regride.

**Maestro (`pnpm test:ops`)** — rodar a suíte existente no dispositivo/emulador para provar que o
driver SQLite nativo sobe (o e2e web só exercita o driver web). Fluxo manual obrigatório antes de
fechar: abrir a casa online, ativar modo avião, matar e reabrir o app, abrir a ficha de um filho.

### Gate de cobertura (trava a story)

> Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste.
> Rodar `pnpm test:ops:unit:cov`; **não reduzir** a cobertura de `lib/offline/` e
> `features/residents/`. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Download dos **binários** de anexos para o dispositivo (só metadados).
- Endpoint em lote no backend (`/residents/by-house/:id/details`) — decisão travada: N requests com
  concorrência limitada.
- Migrar os demais domínios da allowlist (estoque, despensa, ocorrências, atividades, venda de rua)
  do blob para o store — continuam no persister atual.
- Mudanças na outbox/replay ([[169]]) e na tela de pendências ([[170]]).
- Criptografia em repouso do banco local (SQLCipher) — se virar requisito, vira story própria.
- `app.fonte`, `adm.fonte`, `portal.fonte`.
