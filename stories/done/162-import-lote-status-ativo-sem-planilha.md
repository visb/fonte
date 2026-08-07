# Plan: import em lote — ficha fora da planilha entra ATIVA quando tem casa

## Context

Bloco do BACKLOG: **importação em lote de filhos** (fichas `.docx` via IA + planilha de referência).
Relato: *"importação em lote precisa adicionar os residents com status ativo"*.

### Levantamento — onde o status é decidido hoje

Toda a decisão está em `defaultImportStatus` (`apps/adm.fonte/src/features/residents/lib/importCommit.ts:96-101`),
consumida pelos **dois** caminhos de import:

| caso | status hoje | correto? |
|---|---|---|
| ficha **casou** com a planilha | `''` → `ACTIVE` (`importCommit.ts:189`) | ✔ |
| ficha **ambígua** (>1 candidato) | `''` → `ACTIVE` | ✔ |
| ficha **sem correspondência** (`unmatched`) | **`ARCHIVED`** | ✘ é o bug |
| qualquer uma **com data de saída** | `DISCHARGED`/`EVADED` no backend ([[120-import-status-alta-evasao-por-saida]]) | ✔ |

**O import individual tem o mesmo comportamento** — `ImportFichaModal.tsx:70` chama a **mesma**
`defaultImportStatus`. A diferença é só de UI: no modal o status aparece no formulário e o ADM pode
corrigir antes de salvar; na fila do lote o card commita direto
(`ImportItemCard.tsx:72` → `buildCommitPayloadFromPreview`), sem formulário e sem chance de
correção. Por isso a dor apareceu no lote. A correção fica na função compartilhada e serve aos dois.

Complemento do levantamento: a precedência "status já extraído da ficha"
(`importCommit.ts:98-99`) é **letra morta hoje** — o `docx-parser.service.ts` não extrai status
nenhum. Fica no lugar (custo zero, protege extração futura), mas não é por ali que o bug entra.

### A trava do desenho

`ARCHIVED` é o **único** status que o backend aceita sem casa
(`create-resident.dto.ts:25-29`: `houseId` obrigatório exceto `ARCHIVED` — regra do
`BUSINESS_RULES.md`). Uma ficha fora da planilha não tem casa vinda da planilha: só a casa que a IA
leu da própria ficha (`preview.houseName`), quando leu. Virar tudo `ACTIVE` cegamente faria o commit
**falhar com 400** em toda ficha sem casa reconhecível.

### Decisões travadas (refinadas nesta sessão)

1. **Regra nova, completa:**
   ```
   unmatched + casa resolvida    -> ACTIVE
   unmatched + casa NÃO resolvida -> ARCHIVED  (como hoje)
   matched / ambiguous           -> ACTIVE     (como hoje)
   qualquer uma com exitDate     -> ALTA/EVASÃO (backend, story 120 — inalterado)
   ```
   O `ARCHIVED` deixa de ser "não achei na planilha" e passa a ser **"não sei onde esse filho está"**.
2. **Nenhuma ficha trava na fila.** Descartadas as alternativas de bloquear o card pedindo casa
   (825 fichas pendentes × escolha manual) e de casa-padrão configurável (entraria todo mundo ativo
   na casa errada, com correção invisível depois). Filho `ARCHIVED` continua editável e pode ser
   ativado à mão depois — é reversível; casa errada em massa não é.
3. **O status passa a depender da casa resolvida**, então `defaultImportStatus` precisa **do
   `houseId` já resolvido**, não só do preview. Vira
   `defaultImportStatus(preview, resolvedHouseId)`. A resolução em si (`resolveHouseId` sobre
   `matchedHouseName ?? houseName`) já existe e não muda.
4. **Correção 100% no frontend.** O backend nunca impôs `ARCHIVED` — ele só *aceita* o que vem.
   `applyExitStatus` (`import.service.ts:211`) fica intocado: continua derivando alta/evasão a partir
   da permanência, e `ACTIVE` é justamente um dos status "default" que ele tem permissão de
   sobrescrever, então a regra de saída continua ganhando da regra nova. **Sem migration, sem
   endpoint, sem mudança de contrato ⇒ sem `build:types` / `build:api-client` e sem atualizar
   `fonte-api.postman_collection.json`.**
5. **Efeito colateral aceito e desejado:** filho `unmatched` com casa passa a contar nas listagens e
   nas contagens por casa (hoje `ARCHIVED` fica fora). É o ponto do pedido — essas fichas são de
   gente que está na casa.
6. **Fichas já importadas como `ARCHIVED` não são migradas.** Sem backfill: a story muda a regra dali
   para frente. Corrigir o passado é edição manual ou script à parte.

Depende do comportamento fixado pela [[120-import-status-alta-evasao-por-saida]] (derivação de
alta/evasão) e da resolução de casa da [[104-import-tela-lote-fila-cards]]; não bloqueia nem é
bloqueada por nenhuma story em aberto.

## Desenho

Tudo em `apps/adm.fonte`, feature `residents`.

### `lib/importCommit.ts`

1. `defaultImportStatus(preview, resolvedHouseId?: string | null)`:
   - status extraído da ficha continua tendo precedência (letra morta hoje, mantida de propósito);
   - `matchStatus === 'unmatched'` **e** sem `resolvedHouseId` → `ResidentStatus.ARCHIVED`;
   - qualquer outro caso → `''`, que `buildCommitPayload` (`:189`) converte em `ACTIVE`.

   Atualizar o comentário do bloco: hoje ele afirma "ficha fora da planilha entra como ARCHIVED",
   que passa a ser meia verdade.

2. `buildCommitPayloadFromPreview` (`:203`) — resolver a casa **antes** e passar adiante:
   ```ts
   const houseId = resolveHouseId(preview.matchedHouseName ?? preview.houseName, houses);
   const formValues = { ...previewToFormValues(preview.resident), houseId,
                        status: defaultImportStatus(preview, houseId) } as ResidentFormData;
   ```
   Este é o caminho do **card do lote** — o que o usuário relatou.

### `components/import/ImportFichaModal.tsx`

3. O modal calcula o `defaults` (`:59-73`) **antes** de `useHouses` responder, então nesse instante
   ainda não há casa resolvida — passar o `houseId` do memo levaria todo mundo a `ARCHIVED`. O
   `useEffect` que já resolve a casa quando a lista chega (`:86-90`) passa a **recalcular o status
   junto**: ao setar `houseId`, se o campo `status` ainda estiver no default derivado e o preview for
   `unmatched`, `setValue('status', ...)` com o resultado de `defaultImportStatus(preview, id)`.
   Só toca no campo enquanto o ADM não escolheu status à mão — escolha manual sempre vence.

### Sem mudança

4. `useBulkImport.ts:388` não muda (só chama `buildCommitPayloadFromPreview`).
   `ImportItemCard.tsx` não muda — mas o badge "fora da planilha" (`:99-100`) continua correto e
   **independente do status**: a ficha segue sem correspondência mesmo entrando ativa. Vale um
   comentário ali dizendo que badge ≠ status, senão a próxima leitura acha que é bug.
5. Backend inteiro intocado (decisão 4).

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. **Gate: código novo sem teste não
fecha a story** — `pnpm --filter adm.fonte test:unit:cov` verde, com cobertura ≥90 do código tocado
e sem reduzir a de `features/residents`. Frontend puro (decisão 4) ⇒ `pnpm test:api`,
`build:types` / `build:api-client` e `migration:run:test` não são exigidos.
`pnpm test:api` continua sendo rodado como regressão, porque a regra de saída da story 120 é a
vizinha mais próxima — mas nenhum arquivo do backend muda.

- **Unit `importCommit.test.ts`** — a tabela da decisão 1, caso a caso:
  - `unmatched` **com** `houseId` resolvido → `''` (→ `ACTIVE` no payload) — **é o teste que prova o
    bug corrigido**;
  - `unmatched` **sem** casa (`null`/`''`) → `ARCHIVED`, e o payload sai com `houseId` nulo aceito;
  - `matched` e `ambiguous` → `''` → `ACTIVE`, com e sem casa (regressão: nada mudou para eles);
  - preview `null` → `''` (comportamento atual preservado);
  - status extraído da ficha presente → vence os dois casos acima (a precedência da decisão 1);
  - **`buildCommitPayloadFromPreview`**: ficha fora da planilha cujo `preview.houseName` casa com uma
    casa da lista → payload com `status: 'ACTIVE'` **e** o `houseId` daquela casa; a mesma ficha com
    `houses: []` → `status: 'ARCHIVED'`;
  - **regressão da [[120-import-status-alta-evasao-por-saida]]**: preview com `exitDate` continua
    entregando o status que o backend vai converter em alta/evasão — a regra nova não atropela a
    antiga.
- **Unit `ImportFichaModal`** — abrir o modal com ficha `unmatched` **antes** de as casas
  carregarem e, quando a lista chega e a casa resolve, o campo de status passa a `ACTIVE`; se o ADM
  já tiver escolhido um status à mão, o efeito **não** sobrescreve (item 3 do desenho).
- **Unit `ImportItemCard`** — o badge "fora da planilha" continua aparecendo para ficha `unmatched`
  que entra `ACTIVE` (badge ≠ status, item 4).
- **E2E `apps/adm.fonte/e2e/`** (spec do import em lote, se existir): aprovar pelo card uma ficha sem
  correspondência mas com casa reconhecida cria o filho **ativo** e ele aparece na listagem da casa
  — é o único caso que prova a decisão 5 ponta a ponta (o efeito nas contagens/listagens não é
  observável em unit).

## Fora de escopo

- **Backfill dos filhos já importados como `ARCHIVED`** (decisão 6).
- **Casa padrão do import** ou qualquer configuração nova de import (decisão 2).
- **Bloquear o card pedindo a casa** quando ela não resolve (decisão 2).
- **Melhorar o `resolveHouseId`** (fuzzy match, apelidos de casa) — é a causa de parte dos
  `ARCHIVED` que sobrarem, mas é outra story.
- **Extrair status da ficha na IA** (`docx-parser`) — a precedência já existe no código e ficaria
  pronta para receber, mas esta story não a alimenta.
- **Derivação de alta/evasão** ([[120-import-status-alta-evasao-por-saida]]) e histórico de
  múltiplos acolhimentos ([[121-import-multiplos-acolhimentos]]) — inalterados.
- Import via script/CLI (`fonte-import-filhos`) — usa os mesmos endpoints de commit; herda a
  correção sem trabalho próprio.
