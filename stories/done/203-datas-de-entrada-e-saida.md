# Plan: coerência das datas de entrada e saída do acolhimento

## Context

Dois itens do backlog, refinados juntos a pedido do usuário:

- *"na data de entrada, no acolhimento, proibir datas futuras"*
- *"na data de saída, permitir somente data de saída maior que a data de entrada"*

Hoje `entryDate` e `exitDate` só passam por `@IsDateString` (`CreateResidentDto`,
`UpdateResidentDto`, `ReadmitResidentDto`, `ImportAdmissionDto`). Acolhimento com entrada em 2062
(erro de digitação) e saída antes da entrada passam sem aviso. As duas datas alimentam o carnê
(dia de vencimento cai no dia da entrada, `contributionDueDay`), o histórico de passagens, a
ordenação da lista (`RESIDENT_SORT_FIELDS`) e os documentos gerados. Data errada aqui vira
cobrança errada.

### Decisões travadas (usuário)

1. **Uma story para os dois itens**: mesmo par de datas, mesmos caminhos de escrita, mesmo helper.
2. **Saída no mesmo dia da entrada pode**: regra `exitDate >= entryDate`. Evasão no dia do
   acolhimento acontece.
3. **Saída no futuro também é bloqueada.** Alta e evasão registram um fato ocorrido. Uma saída
   futura dispararia `cancelAfterExit` (cancelamento do carnê) e a notificação de alta antes da
   hora.

### Decisões de desenho (defaults assumidos no refino)

4. **Mesma postura da story 202 para dado legado**: só valida a data que foi informada ou alterada
   nesta escrita. Ficha antiga com par incoerente continua salvável editando outro campo. Quando
   uma das duas datas muda, a coerência do **par resultante** (gravado + payload) é checada.
5. **"Hoje" no fuso `America/Sao_Paulo`**, com o `todayInSaoPaulo()` da story 202 em
   `@fonte/types`. Entrada **hoje** é permitida, saída **hoje** também.
6. **Readmissão**: a entrada nova não pode ser futura **e** não pode ser anterior à saída da
   passagem anterior (`entryDate >= última exitDate`). É o mesmo princípio aplicado entre
   passagens; sem isso, a readmissão cria duas passagens sobrepostas no histórico.
7. **Import em lote**: cada passagem do histórico (`ImportAdmissionDto`) obedece às mesmas regras
   (entrada não futura, saída ≥ entrada, saída não futura). Sobreposição entre passagens
   importadas **não** é validada (fora de escopo, dado histórico vindo de ficha em papel).
8. **Mensagens acionáveis**:
   - *"A data de entrada não pode ser no futuro."*
   - *"A data de saída não pode ser anterior à data de entrada (dd/mm/aaaa)."*
   - *"A data de saída não pode ser no futuro."*
   - *"A data de entrada não pode ser anterior à saída do acolhimento anterior (dd/mm/aaaa)."*

### Dependências

- **Story 202**: `todayInSaoPaulo()` em `@fonte/types`. Se esta for implementada antes, cria o
  helper aqui e a 202 reaproveita.
- **Story 201**: `min`/`max` no `DateInput`. Sem ela, os limites vão no input nativo.
- **Story 200**: mexe no `RemoveResidentDialog` e no `RemoveResidentModal` (rótulos/`mode`). As
  duas tocam os mesmos arquivos; quem vier depois rebaseia.

---

## Desenho

### 1. `packages/types`

```ts
export function isFutureDate(date: string, today: string): boolean;  // date > today
export const ADMISSION_DATE_MESSAGES = { entryFuture, exitBeforeEntry, exitFuture, entryBeforePreviousExit };
```

Comparação em string `YYYY-MM-DD`: a ordem lexicográfica é a cronológica, sem fuso.

### 2. Backend (`services/api`)

Helper `assertAdmissionDates({ entryDate, exitDate }, { previous?, today, previousExitDate? })`
no módulo `resident`, chamado **antes** de persistir e de qualquer efeito colateral (follow-up,
`cancelAfterExit`, notificação):

- **`ResidentService.create`** (acolhimento manual): entrada não futura; saída, se vier, ≥ entrada
  e não futura.
- **`ResidentService.update`** (inclui alta e evasão, que chegam como `status` + `exitDate`, do
  `adm` e da fila offline do `ops`): par resultante = gravado ∪ payload; checa só se `entryDate`
  ou `exitDate` mudou (decisão 4). O reenvio idempotente da outbox (mesmo payload) passa: não muda
  nada, então não revalida.
- **`readmit`**: decisão 6, buscando a última passagem encerrada.
- **`ImportService.commit`**: decisão 7, por passagem e na ficha (`resident.entryDate/exitDate`).
  A recusa volta para a revisão do import com a mensagem.

Ordem com o guard de transição da story 196: se a transição for inválida, aquele 400 vem primeiro
(não importa a data de quem já saiu).

Sem migration. Sem rota nova. **Postman**: os 400 novos documentados em create, update, readmit e
commit do import.

### 3. `adm.fonte`

- **Acolhimento** (`ResidentFormSections`): entrada `max = hoje`; saída `min = entrada`,
  `max = hoje`. Zod com `superRefine` para o par, mensagem no campo de saída.
- **`ReadmissionForm`**: entrada `max = hoje`, `min = última saída`, que a tela já tem no
  histórico de passagens (`AdmissionsTab`) ou busca pelo hook existente, sem prop drilling.
- **`RemoveResidentDialog`** (alta/evasão): `exitDate` com `min = resident.entryDate` e
  `max = hoje`, validado no schema do `useResidentRemovalForm`.
- **Revisão do import** (`ImportReviewStep` / `ImportAdmissionsHistory`): mesmas regras por
  passagem, com o erro na linha da passagem.
- Edição de ficha legada com par incoerente e nenhuma das datas alterada: submit liberado
  (decisão 4).

### 4. `ops.fonte`

- **`RemoveResidentModal`** (alta/evasão, pela lista e pela contagem): o `DatePickerModal` ganha
  `minimumDate = entryDate` e `maximumDate = hoje`, e o confirmar fica desabilitado com a mensagem
  se a data estiver fora. O modal precisa da `entryDate` do filho: passar no objeto `resident`
  (que já vem da lista/contagem, onde o dado existe no cache offline) em vez de buscar.
- **`AddResidentModal`** (contagem): se tiver data de entrada, `maximumDate = hoje`.
- Offline: a validação local impede que um lançamento condenado entre na fila. Se ainda assim o
  backend recusar no replay, o item vai para `/sync` com a mensagem (mecanismo existente).

---

## Validação

### `packages/types`

Unit de `isFutureDate` e da comparação de pares: hoje não é futuro; amanhã é; saída = entrada
passa; saída = entrada − 1 dia falha.

### Backend: `pnpm test:api`

- **Create**:
  - entrada amanhã → 400; entrada hoje → ok;
  - saída < entrada → 400; saída = entrada → ok;
  - saída amanhã → 400.
- **Update**:
  - alta com `exitDate` < `entryDate` gravada → 400, e `cancelAfterExit` e a notificação **não**
    são chamados;
  - alta com saída futura → 400;
  - alterar `entryDate` para depois da `exitDate` gravada → 400;
  - ficha legada incoerente + payload sem datas → ok (decisão 4);
  - reenvio idempotente → ok.
- **Readmit**: entrada futura → 400; entrada antes da última saída → 400; entrada = última saída
  → ok.
- **Import commit**: passagem com saída < entrada → recusa, nada persistido; passagem futura →
  recusa; histórico válido → segue igual.
- **Regressão**: specs existentes passam sem mudar a expectativa. Fixtures com data relativa que
  virou futura ou incoerente são corrigidas, e a correção é registrada no PR.

### Backend: `pnpm test:api:e2e`

- `POST` de filho com entrada futura → 400.
- `PATCH` de alta com saída antes da entrada → 400.
- Readmissão antes da última saída → 400.
- Fixtures próprias via API, removidas no `afterAll`, limpeza por id (story 182).

### `adm.fonte`: unit (`pnpm test:adm:unit`)

- `ResidentFormSections`: entrada futura → erro; saída antes da entrada → erro no campo de saída;
  mesmo dia → ok.
- `ReadmissionForm`: `min` = última saída; antes dela → erro.
- `useResidentRemovalForm`: saída antes da entrada ou futura → erro, sem mutation.
- Revisão do import: passagem inválida marcada na linha.
- Ficha legada sem alteração de data → submit liberado.

### `adm.fonte`: e2e (`pnpm test:adm`)

Acolhimento com entrada futura mostra o erro e não salva. Alta pela lista com data anterior à
entrada mostra o erro.

### `ops.fonte`: unit (`pnpm test:ops:unit`)

`RemoveResidentModal`:
- `DatePickerModal` com `minimumDate` = entrada e `maximumDate` = hoje;
- data fora → confirmar desabilitado e nada enfileirado;
- data válida → enfileira como hoje, com a mesma `mutationKey`.

### `ops.fonte`: offline e2e (`e2e-web/`)

O fluxo offline de baixa da story 196 continua passando com uma data válida.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov`, `pnpm test:adm:unit` e
`pnpm test:ops:unit` com cobertura: `assertAdmissionDates` com 100% dos ramos (cada regra, cada
caminho: create, update, readmit, import, legado inalterado); sem reduzir a cobertura de
`resident` e `import`. Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- **Sobreposição entre passagens importadas** (decisão 7).
- **Corrigir dados legados incoerentes**: no máximo, um relatório pontual, sem migration de dados.
- **Saída agendada** (decisão 3).
- **Outras datas** (pagamento, follow-up, curso bíblico, contas a pagar): sem regra nova aqui.
- **Status `TEMP_LEAVE`** (saída temporária): não usa `exitDate` de encerramento; não muda.
