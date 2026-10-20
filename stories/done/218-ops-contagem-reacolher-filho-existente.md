# Plan: contagem do `ops` reacolhe filho que já passou pela comunidade

## Context

Pedido do backlog: *"no app ops, ao adicionar um filho pela contagem, perguntar se o filho ja passou
antes pela casa, se ja passou, tentar encontrar o cadastro dele antes de prosseguir. se encontrar o
cadastro, fazer um novo acolhimento e nao duplicar os dados"*.

Hoje o `AddResidentModal` da Contagem (`features/census/`, COORDINATOR — e ADMIN lotado após a
214) sempre cria um `Resident` novo (`useCensusAddResident`, mutation offline-first da story 171).
Quem volta para a comunidade vira cadastro duplicado: histórico, familiares, anexos e carnê ficam
espalhados em dois filhos. O backend já tem `POST /residents/:id/readmit` (ADMIN/COORDINATOR), que
cria uma `admission` nova e reseta o filho, mas só aceita status `DISCHARGED`/`EVADED`. O import em
lote trouxe muitas fichas `ARCHIVED` (825 pendentes), que hoje nunca poderiam ser reaproveitadas.

### Decisões travadas (usuário)

1. **Busca na comunidade inteira**, não só na casa: o filho pode ter passado por outra casa.
   Candidatos = filhos fora de acolhimento (`DISCHARGED`, `EVADED`, `ARCHIVED`).
2. **Busca por nome e/ou CPF**: CPF exato (normalizado, só dígitos) ou nome parcial sem acento e
   sem caixa (≥3 letras). O operador escolhe na lista de candidatos.
3. **`readmit` passa a aceitar `ARCHIVED`** além de `DISCHARGED`/`EVADED`. Filho `ARCHIVED` sem
   casa volta com a casa da contagem.
4. **Adicionar filho pela contagem exige rede.** Sem conexão, o botão "Adicionar filho" fica
   desabilitado com aviso (*"Sem conexão: para adicionar um filho é preciso estar online, para
   checar se ele já passou pela comunidade."*). É o caminho que o invariante offline-first prevê
   para fluxo que exige rede ("desabilita a ação com aviso"). A mutation de criação continua com
   `mutationKey`/`setMutationDefaults` (se o sinal cair *depois* do envio, o item vai para a fila
   como hoje); só a **entrada** no fluxo é que exige estar online.

### Decisões de desenho (defaults assumidos)

5. **Fluxo em passos dentro do modal**:
   1. *"Este filho já passou pela Fonte de Misericórdia antes?"* — **Sim** / **Não, é a primeira
      vez**.
   2. **Sim** → busca (campo único nome/CPF) → lista de candidatos (foto, nome, nascimento, última
      casa, data da última saída, status). Filho com status ativo em outra casa **não** aparece (é
      transferência, fluxo do `adm`).
   3. Escolheu candidato → tela de confirmação: dados do cadastro (somente leitura) + **data de
      entrada** (mesmas regras da 203: não futura e ≥ última saída). Confirmar → `readmit` com a
      casa da contagem.
   4. Nenhum resultado / "Não é nenhum destes" → segue para o formulário atual de cadastro novo,
      com o que foi digitado na busca pré-preenchido (nome ou CPF).
   5. **Não** → formulário atual, sem mudanças.
6. **Endpoint de busca enxuto (LGPD)**: `GET /residents/lookup?q=` — `@Roles(ADMIN, COORDINATOR)`,
   no máximo 20 resultados, devolve só `id`, `name`, `birthDate`, `photoUrl`, `status`,
   `lastHouseName`, `lastExitDate`. Nada de saúde, familiares, documentos. Acesso auditado
   (`@Audit('resident.lookup', ...)`, sem gravar o termo buscado em claro se for CPF — grava
   mascarado). Busca sem acento via `unaccent` se a extensão já existir; senão `lower()` +
   normalização no service (a implementação verifica, não cria extensão sem necessidade).
7. **Rede de segurança no cadastro novo**: se o CPF informado já pertence a um filho (story 219, CPF
   único), o `POST` volta 409 e o modal oferece *"Já existe um cadastro com este CPF — reacolher?"*,
   levando ao passo 3 com o candidato. Se a 219 ainda não estiver na main, esta parte fica para ela.
8. **Readmit pelo ops**: payload mínimo (`houseId`, `entryDate`); saúde/peso/investimento ficam
   vazios para o `adm` completar, como no cadastro rápido de hoje. Não duplica foto: mantém a do
   cadastro (trocar foto fica fora). Mutation com `mutationKey` + `setMutationDefaults` +
   `networkMode: 'offlineFirst'` (padrão do app), invalida censo e residentes da casa.
9. **Relative obrigatório** não se aplica: o reacolhimento reaproveita os familiares do cadastro.

### Dependências

- **214** (admin lotado também acessa a Contagem) — independente; vale para quem tiver acesso.
- **219** (CPF único) — habilita a decisão 7. Pode vir antes ou depois.
- **215** (edição do histórico) — independente.

---

## Desenho

### 1. Backend (`services/api`)

- `ResidentService.readmit`: aceita `ARCHIVED`; mensagem de erro atualizada. Conferir efeitos que
  dependem do status anterior (carnê, notificação de readmissão) para `ARCHIVED`.
- `ResidentService.lookup(q)` + `GET /residents/lookup` (decisão 6), rota declarada **antes** de
  `:id` no controller.
- `LookupResidentsQueryDto` (`q`: string, min 3, trim).
- **Postman**: `GET /residents/lookup`; `POST /residents/:id/readmit` com nota sobre `ARCHIVED`.
- `BUSINESS_RULES.md`: readmissão aceita `ARCHIVED`; contagem do ops pergunta antes de cadastrar.

### 2. Contratos

- `@fonte/types`: `ResidentLookupItem`.
- `@fonte/api-client`: `residents.lookup(q)`. `pnpm build:types` / `pnpm build:api-client`.

### 3. `ops.fonte`

```
features/census/
  components/AddResidentModal.tsx          ← vira orquestrador de passos
  components/AddResidentReturningStep.tsx  ← pergunta Sim/Não
  components/ResidentLookupStep.tsx        ← busca + lista
  components/ResidentLookupItem.tsx        ← item da lista
  components/ReadmitConfirmStep.tsx        ← confirmação + data de entrada (RHF + zod, Controller)
  hooks/useCensus.ts                       ← useResidentLookup (query, enabled por termo ≥3),
                                             useCensusReadmit (mutationKey + defaults)
lib/queryKeys.ts                           ← residents.lookup(q)
lib/offline/mutationDefaults.ts            ← default do readmit
```

- `CensusPage`: botão "Adicionar filho" desabilitado offline (hook de conectividade existente) com o
  aviso da decisão 4.
- `residents.lookup` **não** entra na allowlist de persistência offline (dado de pessoas fora da
  casa; LGPD).

---

## Validação

### Backend: `pnpm test:api`

- `readmit` de `ARCHIVED` (com e sem casa) → nova admission, status ativo, casa da contagem;
  `ACTIVE` → 400 continua.
- `lookup`: por CPF com e sem máscara; por nome parcial, sem acento/caixa; exclui ativos e
  soft-deletados; limite 20; termo <3 → 400; resposta só com os campos da decisão 6.

### Backend: `pnpm test:api:e2e`

- COORDINATOR busca e reacolhe filho `ARCHIVED` de fixture → aparece no censo da casa;
  SERVANT → 403 no lookup.
- Fixtures próprias via API, removidas no `afterAll`, limpeza por id (story 182).

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- Passos: Sim → busca → escolher → confirmar chama readmit com `houseId`/`entryDate`; "Não é nenhum"
  → formulário com termo pré-preenchido; Não → formulário direto.
- Validação de data na confirmação (futura, antes da última saída).
- Offline: botão desabilitado + aviso.
- `mutationDefaults`: readmit tem `mutationKey` e default registrado.
- 409 de CPF duplicado oferece reacolher (se a 219 já estiver na main).

### `ops.fonte`: Playwright web (`e2e-web/`) + Maestro (`pnpm test:ops`)

- Playwright: `context.setOffline(true)` → "Adicionar filho" desabilitado com aviso.
- Maestro: fluxo Sim → busca por nome de filho `ARCHIVED` do seed (ou fixture) → reacolher →
  aparece na contagem. Se o seed não tiver filho fora de acolhimento, ajustar `seed-test.ts` sem
  quebrar a idempotência.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` sem reduzir a cobertura de `resident`;
`lookup` e o ramo `ARCHIVED` ≥90%. `pnpm test:ops:unit` com cobertura dos passos/hooks novos ≥90%.
Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- Mesmo fluxo de "já passou?" no `adm.fonte` (acolhimento manual) — candidato a story própria.
- Transferir filho ativo de outra casa pela contagem.
- Mesclar cadastros já duplicados.
- Atualizar foto/dados pessoais no reacolhimento pelo ops.
- Busca fonética/fuzzy além de parcial sem acento.
