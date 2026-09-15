# Plan: remover o vínculo filho↔ministério — ministério passa a ser coisa de servo

## Context

O pedido nasceu como "remover o campo ministério dos filhos". O levantamento mostrou que não existe
"o campo": `residents.ministry_id` **é** o mecanismo de filiação a ministério por inteiro. Quem
depende dela:

- `ministry.service.ts:55` — a contagem de membros na listagem de ministérios da casa.
- `ministry.service.ts:96` — a lista de membros no detalhe do ministério.
- `ministry.service.ts:138,157` — `addResident` / `removeResident`, expostos em
  `POST /ministries/:id/residents` e `DELETE /ministries/:id/residents/:residentId`.
- `ministries.leader_id` + `leader_type = 'RESIDENT'` — um ministério pode ser liderado por um filho.
- `admissions.ministry_id` — o ministério gravado no acolhimento.
- `FollowUpType.MINISTRY_CHANGE` — evento automático na linha do tempo, emitido em
  `resident.service.ts:352`.
- `resident.service.ts:76,127,201,275,306` — campo pesquisável, três `leftJoin` e o retorno do
  `create`.

A decisão do usuário é tirar **o vínculo inteiro**: ministério continua existindo como organização de
trabalho da casa, com servos e tarefas, mas deixa de ter filho como membro e como líder. O que a
story remove não é um input de formulário — é um conceito de domínio, com rota, coluna e tela.

Por isso ela é, acima de tudo, uma story de **subtração completa**: meia remoção deixa rota que
responde 500, tela que renderiza lista vazia sem explicação e coluna órfã que a próxima pessoa
acha que ainda vale.

### Decisões travadas (usuário)

1. **Sai o vínculo filho↔ministério inteiro.** Ministério vira coisa de servo: mantém nome, casa,
   líder (agora só `STAFF`), servos (`ministry_staff`) e tarefas (`ministry_tasks`).
2. **As duas colunas são dropadas**: `residents.ministry_id` e `admissions.ministry_id`. Migration
   nova, irreversível quanto ao dado — o `down()` recria as colunas **vazias**, e isso vai escrito no
   próprio arquivo da migration para ninguém contar com um rollback que não devolve nada.
3. **Líder vira só staff.** `leader_type` deixa de aceitar `RESIDENT`; a migration zera
   `leader_id`/`leader_type` dos ministérios que hoje têm filho como líder.
4. **O histórico da linha do tempo fica.** `FollowUpType.MINISTRY_CHANGE` para de ser **gerado**, mas
   os eventos já gravados continuam renderizados com rótulo e ícone nos dois apps. Linha do tempo é
   histórico; apagar reescreve o passado de um acompanhamento que alguém pode ter citado em relatório.

### Decisões de desenho derivadas (do levantamento no código)

5. **O enum `FollowUpType` mantém `MINISTRY_CHANGE`.** Decorre da decisão 4: remover o valor do enum
   quebraria a renderização dos eventos antigos (os mapas de rótulo/ícone são
   `Record<FollowUpType, …>`) e deixaria linhas no banco com um tipo que o código não conhece. O que
   sai é a **emissão** (`resident.service.ts:352`), não o tipo.
6. **As duas rotas de membro são removidas**, não esvaziadas: `POST /ministries/:id/residents` e
   `DELETE /ministries/:id/residents/:residentId` deixam de existir (404 pela ausência da rota).
   Rota que aceita e ignora é pior que rota que sumiu — o cliente acha que gravou.
7. **`useCreateMinistry` deixa de ser orquestração.** Hoje (`useMinistries.ts:45`) ele faz
   `addMinistry` + `update(leader)` + N × `addResident` num `Promise.all` — três chamadas sem
   transação, onde a falha parcial deixa ministério criado sem líder nem membros. Sem os membros,
   sobra `addMinistry` + `update(leader)`; o hook encolhe e o modo de falha some junto.
8. **`ministries` sai do store local de filho.** `RESIDENT_STORE_QUERY_PREFIXES` inclui
   `'house-ministries'` com o comentário *"(ministério do filho)"* — a justificativa era carregar dado
   pessoal de filho. Sem membros, a resposta não tem mais nome de filho e a chave **não** pertence ao
   store da story 175 (que promete guardar até o logout). Ela passa para
   `PERSISTED_QUERY_PREFIXES`, o blob de 24h, como as demais leituras de casa. Deixar onde está seria
   manter tratamento de dado pessoal para dado que deixou de ser pessoal.
9. **`PERSIST_BUSTER` é incrementado** para `'v2'`. A forma dos dados cacheados muda (some
   `ministry` do filho, some `residents` do ministério) — é exatamente o caso que o buster existe
   para cobrir (`constants.ts:16`). Sem isso, o app reidrata cache antigo e renderiza campo que não
   existe mais.
10. **O import em lote perde o campo.** `import.service.ts` mapeia `ministryId`; o mapeamento sai. As
    825 fichas pendentes (memória do projeto) passam a ser importadas sem ministério — nenhum dado é
    perdido porque a coluna de destino deixou de existir.
11. **Nada de "migrar filho para servo do ministério".** Filho não vira `MinistryStaff` — a tabela é
    de staff e tem FK para `staff`. Quem servia num ministério simplesmente deixa de constar.

---

## Desenho

### 1. Migration (nova, decisões 2 e 3)

```sql
-- up
UPDATE ministries SET leader_id = NULL, leader_type = NULL WHERE leader_type = 'RESIDENT';
ALTER TABLE residents  DROP COLUMN ministry_id;   -- dropa a FK junto
ALTER TABLE admissions DROP COLUMN ministry_id;

-- down: recria as colunas VAZIAS. O dado não volta — e o líder zerado tampouco.
```

Os índices/FKs de `ministry_id` das duas tabelas caem com a coluna. **Nenhuma** migration existente é
editada (CLAUDE.md).

### 2. `packages/types` e `packages/api-client`

- `Resident.ministryId` / `Resident.ministry` removidos; idem em `Admission`.
- `Ministry.leaderType` passa a `'STAFF' | null`.
- `MinistryDetail.residents` removido; a contagem de membros na listagem passa a contar **servos**.
- `api.ministries.addResident` / `removeResident` removidos.
- `CreateResidentInput` / `UpdateResidentInput` sem `ministryId`.

### 3. Backend

**`resident.entity.ts`** — fora a relação `ManyToOne(Ministry)` e a coluna (linhas 50-55).
**`admission.entity.ts`** — fora a coluna (linhas 35-36).
**`create-resident.dto.ts` / `update-resident.dto.ts`** — fora `ministryId`. Enviar o campo passa a
ser rejeitado pelo `ValidationPipe` (`forbidNonWhitelisted`), o que é o comportamento certo: cliente
velho descobre na hora, em vez de achar que gravou.

**`resident.service.ts`**
- `ministryId` sai da lista de campos pesquisáveis (linha 76).
- Os três `leftJoinAndSelect('resident.ministry', …)` (127, 201, 275) saem.
- O retorno do `create` perde `ministryId` (306).
- O bloco que emite `MINISTRY_CHANGE` (352-354) sai — o tipo do enum **fica** (decisão 5).
- Os `ministryId: null` de 480 e 502 saem.

**`ministry.service.ts`**
- `findAllByHouse`: o `LEFT JOIN residents res ON res.ministry_id` (55) sai; a contagem exibida passa
  a ser de servos.
- `findOne`: o `SELECT … WHERE ministry_id = $1` (96) sai; o `LEFT JOIN residents r` do líder (54, 88)
  sai com a decisão 3.
- `addResident` / `removeResident` (138-161) removidos.
- `update`: `leaderType = 'RESIDENT'` passa a ser **400** (*"Ministério só pode ser liderado por um
  servo."*) — a rota fica, o valor não.

**`ministry.controller.ts`** — as duas rotas da decisão 6 removidas.
**`import.service.ts`** — mapeamento de `ministryId` removido (decisão 10).

`fonte-api.postman_collection.json`: duas rotas removidas, `ministryId` fora dos corpos de
resident/admission, o 400 novo do `leaderType` documentado.

### 4. `ops.fonte`

**Removidos**: `features/residents/components/ChangeMinistryModal.tsx` e o botão que o abre em
`ResidentOverviewTab` / `ResidentDetailPage`.

**`features/ministries/`**
- `MinistryOverviewTab`: seção de membros removida; fica líder (servo), servos e tarefas.
- `LeaderPickerModal`: passa a listar **só servos** — a aba/segmento de filhos sai.
- `useMinistries`: `useHouseResidents` (linha 7) e as mutations de membro saem;
  `useCreateMinistry` encolhe conforme a decisão 7.

**`lib/offline/constants.ts`**: `'house-ministries'` migra de `RESIDENT_STORE_QUERY_PREFIXES` para
`PERSISTED_QUERY_PREFIXES` (decisão 8), com o comentário do porquê. `PERSIST_BUSTER` → `'v2'`
(decisão 9).

**`TrackingEventItem`**: inalterado — continua mapeando `MINISTRY_CHANGE` (decisão 4).

### 5. `adm.fonte`

- `features/residents/components/tabs/OverviewTab.tsx:107`: a `InfoRow` "Ministério" sai.
- `features/houses/components/tabs/EditMinistryLeaderDialog.tsx`: só servos como líder.
- `features/houses/components/tabs/MinistriesTab.tsx` / `AddMinistryDialog`: sem seleção de filhos; a
  contagem exibida passa a ser de servos.
- `features/houses/hooks/useHouseMinistries.ts`: mutations de membro removidas.
- `features/residents/constants.ts` e `TrackingEventItem.tsx`: **inalterados** (decisão 4).
- Formulário de filho: nenhum campo a remover — o `ministryId` nunca esteve lá; a filiação sempre foi
  gerida pelo lado do ministério.

---

## Validação

### Migration — `pnpm migration:run:test`

Verde com a migration nova. Testes específicos: depois do `up`, `residents` e `admissions` **não**
têm mais a coluna (consulta ao `information_schema`), e nenhum ministério tem
`leader_type = 'RESIDENT'`. O `down` recria as colunas nulas sem quebrar — e o teste **afirma** que
elas voltam vazias, para o comportamento ficar documentado em vez de surpreender.

### Backend — `pnpm test:api`

- **`ministry.service.findOne`**: devolve líder (servo), servos e tarefas; **não** devolve `residents`;
  ministério com líder zerado pela migration não quebra a serialização.
- **`findAllByHouse`**: a contagem exibida é de servos; ministério sem servo nenhum → 0, não erro.
- **`update` com `leaderType: 'RESIDENT'`** → 400 e **nenhuma** alteração persistida.
- **`resident.service.update`**: mudar qualquer campo **não** cria follow-up `MINISTRY_CHANGE`
  (decisão 5 — é o teste que prova que a emissão morreu); os follow-ups do tipo já existentes
  continuam sendo devolvidos pela linha do tempo, com rótulo.
- **DTO**: `POST/PATCH /residents` com `ministryId` no corpo → **400** do `ValidationPipe`.
- **Busca de filho**: o termo continua casando por nome/CPF; `ministryId` deixa de ser campo
  pesquisável sem quebrar a query (regressão do `SEARCHABLE_FIELDS`).
- **`import.service`**: ficha com ministério na planilha importa normalmente, ignorando o campo.
- **Varredura de resíduo** — o teste que a decisão de "subtração completa" exige: `grep` no build do
  backend não encontra `ministry_id` fora da migration histórica e da nova.

### Backend — `pnpm test:api:e2e`

- `POST /ministries/:id/residents` e `DELETE /ministries/:id/residents/:residentId` → **404**
  (rota inexistente), para ADMIN inclusive.
- `GET /ministries/:id` → `200` sem a chave `residents`.
- `GET /residents/:id` → `200` sem `ministry`/`ministryId`.
- `PATCH /ministries/:id` com `leaderType: 'RESIDENT'` → `400`.
- Fixtures conforme a story 182.

### Contratos

`pnpm build:types` e `pnpm build:api-client` — e aqui o build é o próprio teste: como `Resident`,
`Admission` e `Ministry` perdem campos, **qualquer** app que ainda os leia quebra a compilação. Os
quatro apps têm que compilar (`pnpm build:api`, build do `adm`, `tsc` do `ops` e do `app`).

### `ops.fonte` — unit (`pnpm test:ops:unit`)

- `MinistryOverviewTab` não renderiza seção de membros; renderiza servos e tarefas.
- `LeaderPickerModal` lista só servos; nenhum caminho para escolher filho.
- `ResidentOverviewTab` não tem o botão de trocar ministério.
- **Offline (decisões 8 e 9)**: `isPersistableQueryKey(['house-ministries', h])` → **`true`**;
  `isResidentStoreQueryKey` da mesma chave → **`false`**; `PERSIST_BUSTER === 'v2'`. São os três
  testes que impedem o cache antigo de reidratar num formato que não existe mais.
- `TrackingEventItem` continua renderizando um evento `MINISTRY_CHANGE` histórico com rótulo e ícone.

### `adm.fonte` — unit (Vitest/RTL)

- `OverviewTab` do filho não tem a linha "Ministério".
- `MinistriesTab` / `AddMinistryDialog` sem seleção de filhos; `EditMinistryLeaderDialog` só com
  servos.
- `TrackingEventItem` continua renderizando o evento histórico.

### E2E

- `adm.fonte` (Playwright): criar ministério com líder servo e ver a casa listá-lo; a ficha do filho
  não mostra ministério em lugar nenhum.
- `ops.fonte` (Maestro): abrir um ministério e ver líder, servos e tarefas — sem aba de membros.

### Gate de cobertura (trava a story)

Código novo ou alterado sem teste não fecha a story. `pnpm test:api:cov`, `pnpm test:ops:unit` e
`pnpm test:adm:unit` com cobertura; **não reduzir** a cobertura de `ministry` e `resident` no backend
nem das features `ministries`/`residents` dos dois apps. Obrigatoriamente cobertos: a não-emissão de
`MINISTRY_CHANGE` (decisão 5), a recusa de `leaderType: 'RESIDENT'` (decisão 3) e as três asserções
de offline (decisões 8 e 9). Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- **Remover o módulo de ministérios.** Ele continua inteiro para servos: nome, casa, líder, servos e
  tarefas.
- **Remover `FollowUpType.MINISTRY_CHANGE` do enum** (decisão 5) e apagar os eventos já gravados
  (decisão 4).
- **Migrar filho para servo do ministério** (decisão 11) — `ministry_staff` tem FK para `staff`.
- **Recuperar o histórico depois do drop** (decisão 2): não há backup lógico do vínculo dentro desta
  story. Quem quiser o dado antigo tira do backup do banco **antes** de rodar a migration em produção
  — o runbook é a skill `fonte-backup`.
- **Tarefas de ministério atribuídas a filho**: `ministry_tasks` não referencia filho hoje (só
  `ministry_id`, título e conclusão), então não há nada a remover ali.
- **`app.fonte` e `portal.fonte`** — não tocam em ministério.
