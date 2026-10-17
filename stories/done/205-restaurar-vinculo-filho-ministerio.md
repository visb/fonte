# Plan: restaurar o vínculo filho↔ministério (desfazer a story 197), só com filhos em acolhimento

## Context

A story 197 (`1884270`, 15/09/2026) tirou o vínculo filho↔ministério inteiro: filho como membro,
filho como líder, `residents.ministry_id`, `admissions.ministry_id`, as rotas
`POST/DELETE /ministries/:id/residents` e a emissão de `FollowUpType.MINISTRY_CHANGE`. Ministério
virou coisa só de servo.

Na prática, a casa organiza o trabalho dos filhos por ministério (cozinha, horta, limpeza), e os
coordenadores sentiram falta do campo. O que motivou a reclamação foi o campo "Adicionar filho" de
um build antigo do `ops`, que listava **filhos que já tinham saído da comunidade**. A decisão do
usuário é **desfazer a 197 por inteiro** e, desta vez, corrigir o problema original: o vínculo só
existe para filho em acolhimento.

### Decisões travadas (usuário)

1. **Volta tudo como antes da 197**:
   - filho como **membro** do ministério;
   - filho como **líder** (`leader_type = 'RESIDENT'`);
   - **ministério na ficha** do filho (`residents.ministry_id`) e no **acolhimento**
     (`admissions.ministry_id`);
   - evento **`MINISTRY_CHANGE`** na linha do tempo;
   - mapeamento de `ministryId` no **import em lote**.
2. **Começar vazio.** Os vínculos apagados pela migration `DropResidentMinistryLink` em produção não
   são recuperados do backup. Os coordenadores refazem pelo app.
3. **Saída da comunidade desfaz o vínculo automaticamente.** Alta, evasão ou transferência de casa
   tira o filho do ministério (e da liderança, se for o líder). "Adicionar filho" e o seletor de
   líder só listam filhos **em acolhimento na mesma casa** do ministério.

### Decisões de desenho (defaults assumidos)

4. **Migration nova; nenhuma existente é editada** (CLAUDE.md). `RestoreResidentMinistryLink`
   recria `residents.ministry_id` e `admissions.ministry_id` (nullable, FK para `ministries`,
   `ON DELETE SET NULL`, índice em `residents.ministry_id`). A `DropResidentMinistryLink` continua no
   histórico. **Não** usar `git revert 1884270`: a reversão apagaria o arquivo dessa migration, e o
   código mudou bastante desde então (stories 196, 198, 200+), com conflitos garantidos. O diff da
   197 (`git show 1884270`) é a **referência** do que reintroduzir, arquivo por arquivo.
5. **"Em acolhimento" = `REMOVABLE_RESIDENT_STATUSES`** (`ACTIVE`, `DISCIPLINE`, `TEMP_LEAVE`), a
   constante que a story 196 criou em `@fonte/types`. Uma lista só para a busca, o backend e a
   limpeza na saída.
6. **A regra é do backend**, não só do filtro da tela:
   - `addResident` e o update de líder recusam com **400** o filho fora de acolhimento ou de outra
     casa (*"Só filho em acolhimento nesta casa pode participar do ministério."*);
   - o update do filho (`ministryId` na ficha ou no acolhimento) valida o mesmo.

   O build antigo mostrou que filtro só de tela não segura.
7. **Limpeza na saída, no `ResidentService.update`**, na mesma transação da mudança de status/casa:
   - `status` passa a `DISCHARGED`/`EVADED` → `ministry_id = NULL`, e se ele lidera algum ministério
     → `leader_id/leader_type = NULL`;
   - `houseId` muda (transferência) → mesma limpeza (o ministério é da casa de origem).

   Emite `MINISTRY_CHANGE` ("saiu do ministério X") na linha do tempo, como qualquer troca.
   Readmissão volta **sem** ministério.
8. **Dado legado incoerente** (só existe se algo escapar): `findOne`/`findByHouse` do ministério
   listam como membros só filhos em acolhimento na casa. Sem migration de limpeza, porque a coluna
   nasce vazia.
9. **Offline do `ops`**: as mutations de ministério não são fluxo de campo da lista do CLAUDE.md;
   voltam como eram antes da 197 (exigem rede, ação desabilitada com aviso sem sinal). O cache:
   - `house-ministries` volta a carregar nome de filho → volta para o store local de filho
     (`RESIDENT_STORE_QUERY_PREFIXES`, story 175), desfazendo a decisão 8 da 197;
   - `PERSIST_BUSTER` incrementa (`v2` → `v3`), porque a forma do cache muda de novo.
10. **Contagem na listagem de ministérios** volta a somar servos + filhos, com rótulos separados
    ("3 servos · 5 filhos") em vez de um número só.
11. **Rotas voltam com o contrato pré-197**: `POST /ministries/:id/residents` (body `residentId`) e
    `DELETE /ministries/:id/residents/:residentId`, mesmas roles de antes. `UpdateMinistryDto` volta
    a aceitar `leaderType: 'RESIDENT'`.

### Interação com outras stories

- **196/200** (baixa pela lista) e **203** (datas): a limpeza da decisão 7 roda no mesmo
  `ResidentService.update` que essas stories tocam. Quem implementar depois rebaseia. A limpeza fica
  **depois** dos guards de transição (196) e de data (203): transição recusada não limpa nada.
- **204** (lista de servos): `ledMinistries` lá é só de servo; filho líder não aparece nessa lista.

---

## Desenho

Referência: `git show 1884270` (diff inverso, aplicado à mão).

### 1. Migration `RestoreResidentMinistryLink`

```sql
-- up
ALTER TABLE residents  ADD COLUMN ministry_id uuid NULL REFERENCES ministries(id) ON DELETE SET NULL;
ALTER TABLE admissions ADD COLUMN ministry_id uuid NULL REFERENCES ministries(id) ON DELETE SET NULL;
CREATE INDEX idx_residents_ministry_id ON residents(ministry_id);
-- down: dropa as colunas (dado criado depois desta migration se perde; aviso no topo do arquivo)
```

Conferir o `ON DELETE` original (se ministério tem soft delete, a limpeza vai para o service de
exclusão do ministério).

### 2. Backend

- Entities: `Resident.ministry` (`ManyToOne`) e `ministryId`; `Admission.ministryId`.
- DTOs: `ministryId` opcional em `CreateResidentDto`/`UpdateResidentDto`; `AddMinistryMemberDto`
  volta; `UpdateMinistryDto` aceita `'RESIDENT'`.
- `MinistryService`:
  - `addResident`/`removeResident` voltam, com o guard da decisão 6;
  - `findByHouse`/`findOne` voltam a trazer filhos, filtrados pela decisão 8;
  - contagem separada (decisão 10).
- `MinistryController`: as duas rotas (decisão 11).
- `ResidentService`:
  - `ministryId` volta à lista de campos pesquisáveis, aos `leftJoin` e ao retorno;
  - a emissão de `MINISTRY_CHANGE` volta;
  - guard da decisão 6 e limpeza da decisão 7.
- `ImportService`: o mapeamento de `ministryId` volta. A ficha importada como `ARCHIVED` (ou fora
  de acolhimento) é importada **sem** ministério, pela decisão 6.
- Postman: as duas rotas de volta, o `leaderType` `RESIDENT` e os 400 novos.

### 3. Contratos

`@fonte/api-client`:
- `Resident.ministryId/ministry`, `Admission.ministryId`;
- `MinistryDetail.residents`;
- `leaderType: 'STAFF' | 'RESIDENT' | null`;
- `api.ministries.addResident/removeResident`;
- `CreateResidentInput`/`UpdateResidentInput` com `ministryId`.

`pnpm build:types` / `pnpm build:api-client`.

### 4. `adm.fonte`

Reintroduzir, filtrando sempre por casa + `REMOVABLE_RESIDENT_STATUSES`:
- linha "Ministério" na ficha (`OverviewTab`) e campo no acolhimento;
- seleção de filhos no `AddMinistryDialog`;
- filho no `LeaderAutocomplete`/`EditMinistryLeaderDialog`;
- coluna de contagem no `MinistriesTab`.

`useCreateMinistry`: **não** volta o `Promise.all` de N `addResident` sem transação (a decisão 7
da 197 continua certa). Criar o ministério e depois adicionar membros pela tela de detalhe, ou um
endpoint de criação que aceite membros numa transação. Default: tela de detalhe.

### 5. `ops.fonte`

- `MinistryOverviewTab`: seção "Adicionar filho" (busca só nos filhos em acolhimento da casa, a
  partir do store local de filho, que já guarda a lista da casa) e "Filhos (N)" com remover.
- `CreateMinistryModal`/`LeaderPickerModal`: filho em acolhimento como opção de líder.
- `ChangeMinistryModal` + botão na ficha do filho (`ResidentDetailPage`/`ResidentOverviewTab`),
  listando só os ministérios da casa do filho.
- `lib/offline/constants.ts`: decisão 9 (prefixo de volta ao store de filho, `PERSIST_BUSTER`
  `v3`); `lib/queryKeys.ts` com a key removida pela 197.
- Sem sinal: ações de ministério desabilitadas com aviso (fluxo que exige rede).

---

## Validação

### Backend: `pnpm test:api`

- **Migration**: up cria as colunas/FK/índice; down dropa (spec de migration, como o
  `resident-ministry-link.spec.ts` da 197, que é **adaptado**, não apagado).
- **`addResident`**:
  - filho `ACTIVE`/`DISCIPLINE`/`TEMP_LEAVE` da casa → ok;
  - `DISCHARGED`/`EVADED`/`ARCHIVED`/`PRE_ADMISSION` → 400;
  - filho de outra casa → 400.
- **Líder filho**: mesmas regras; `leaderType: 'RESIDENT'` volta a ser aceito para filho válido.
- **`ResidentService.update`**:
  - alta/evasão → `ministry_id` nulo, liderança limpa e `MINISTRY_CHANGE` emitido;
  - transferência → idem;
  - transição recusada pelo guard da 196 → nada limpo;
  - troca de ministério pela ficha emite `MINISTRY_CHANGE`.
- **`findOne`/`findByHouse`**: só membros em acolhimento na casa; contagem separada.
- **Import**: ficha ativa com ministério → vínculo gravado; ficha `ARCHIVED` com ministério →
  importada sem vínculo.
- **Regressão**: os specs que a 197 alterou para "sem filho" voltam a cobrir filho. Nenhum spec é
  apagado sem substituto.

### Backend: `pnpm test:api:e2e`

`ministries.e2e-spec.ts` estendido:
- adicionar e remover filho;
- 400 para filho que já saiu;
- alta pela rota de update tira o filho do ministério;
- roles como antes da 197.

Fixtures próprias via API, removidas no `afterAll`, limpeza por id (story 182).

### `adm.fonte`: unit (`pnpm test:adm:unit`) + e2e (`pnpm test:adm`)

- Unit: seleção de filhos no ministério e de filho líder só com filhos em acolhimento da casa;
  linha "Ministério" na ficha; campo no acolhimento.
- E2E (`houses.spec.ts`, que hoje afirma a ausência da busca de filho): inverter a asserção.
  Adicionar filho ativo ao ministério; filho com alta não aparece na busca.

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- `MinistryOverviewTab`: "Adicionar filho" lista só filhos em acolhimento da casa (o teste que
  motivou a story: filho `DISCHARGED` não aparece); adicionar e remover.
- `ChangeMinistryModal`: só ministérios da casa.
- `persister.test.ts`: prefixo de volta ao store de filho; `PERSIST_BUSTER` `v3`.
- Sem sinal: ações desabilitadas com aviso.

### `ops.fonte`: Maestro (`pnpm test:ops`)

`e2e/ministries.yaml`: adicionar filho ao ministério e vê-lo na lista.

### Gate de cobertura (trava a story)

Todo caminho novo ou restaurado tem teste. Nenhum código entra sem teste. `pnpm test:api:cov`
(`ministry` e `resident` sem queda), `pnpm test:adm:unit` e `pnpm test:ops:unit` com cobertura.
Cobertura obrigatória nos dois pontos que a story existe para fechar: o guard da decisão 6 (cada
status) e a limpeza na saída da decisão 7 (alta, evasão, transferência). Sem `skip`/`only`/`xfail`
sem justificativa explícita no código.

---

## Fora de escopo

- **Recuperar os vínculos antigos do backup** (decisão 2).
- **Filho como `MinistryStaff`**: filho continua membro pela coluna em `residents`, não pela tabela
  de servos.
- **Vários ministérios por filho**: continua um (`residents.ministry_id`), como antes da 197.
- **Tornar ministério fluxo de campo offline** (fila/outbox): continua exigindo rede.
- **Editar migration existente** (`DropResidentMinistryLink` fica como está).
