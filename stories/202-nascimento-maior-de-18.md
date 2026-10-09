# Plan: data de nascimento só de maiores de 18 anos, para filho e servo

## Context

A comunidade acolhe e emprega só adultos. Hoje a data de nascimento aceita qualquer data válida: o
backend só checa o formato (`@IsDateString` em `CreateResidentDto`, `UpdateResidentDto`,
`UpdateResidentIdentityDto`; `@IsString` em `CreateStaffDto` / `UpdateStaffDto`). Erros de
digitação como `2006` no lugar de `1966`, ou o ano corrente, passam sem aviso e aparecem depois nos
documentos gerados (idade na ficha, termos).

Pedido do backlog: validar e só permitir cadastro de filhos ou servos maiores de 18 anos.

### Decisões travadas (usuário)

1. **Backend + telas.** O backend recusa com **400** em qualquer caminho de escrita, e as telas
   validam antes de enviar (e bloqueiam as datas no calendário). Regra só na tela deixaria passar o
   `ops.fonte`, o import em lote e a API direta.
2. **Só valida quando a data é informada ou alterada.** Na criação, valida se a data veio. Na
   edição, valida só se `birthDate` veio no payload **e** é diferente da gravada. Cadastro antigo
   com menor de 18 (digitação errada) continua salvável quando a pessoa edita outro campo; a regra
   pega quem mexe na data.
3. **Idade contada na data de hoje** (≥ 18 anos completos hoje), igual para filho e servo. O import
   histórico não é afetado: quem era adulto quando foi acolhido continua adulto hoje.

### Decisões de desenho (defaults assumidos no refino)

4. **18 anos completos**: quem faz 18 hoje passa; quem faz 18 amanhã não. Limite:
   `birthDate <= hoje - 18 anos` (29/02 conta como 28/02 em ano não bissexto, comportamento do
   `date-fns`/`subYears`).
5. **"Hoje" no fuso `America/Sao_Paulo`**, como data (`YYYY-MM-DD`), não como instante UTC. Senão,
   entre 21h e 0h, o backend já estaria no dia seguinte.
6. **Uma regra só, em `@fonte/types`**: `MIN_PERSON_AGE = 18`, `maxBirthDateFor(today)` e
   `isAdultBirthDate(birthDate, today)`. Backend, `adm`, `ops` e o futuro `DateInput` (story 201)
   usam a mesma função.
7. **Data de nascimento continua opcional.** A story não torna o campo obrigatório: nulo ou vazio
   passa, como hoje.
8. **Promoção de filho a servo não revalida.** `PromoteToServantDialog` / `promote-to-servant`
   copiam a data que já está na ficha do filho; nada foi informado agora. Pela decisão 2, uma ficha
   antiga com dado ruim não trava a promoção.
9. **Mensagem única e acionável**: *"A pessoa precisa ter pelo menos 18 anos. Confira a data de
   nascimento."*

### Dependências

- **Story 201** (`DateInput` com `min`/`max`) para bloquear as datas no calendário do `adm`. Se a
  201 não estiver pronta quando esta for implementada, o `max` vai no `<input type="date">` nativo,
  e a 201 o preserva na migração. Não bloqueia.

---

## Desenho

### 1. `packages/types`

```ts
export const MIN_PERSON_AGE = 18;

/** Data de hoje (YYYY-MM-DD) no fuso da operação. */
export function todayInSaoPaulo(now = new Date()): string;

/** Maior data de nascimento aceita para quem tem MIN_PERSON_AGE completos em `today`. */
export function maxBirthDateFor(today: string): string;

export function isAdultBirthDate(birthDate: string, today: string): boolean;

export const MIN_AGE_MESSAGE =
  'A pessoa precisa ter pelo menos 18 anos. Confira a data de nascimento.';
```

Se `@fonte/types` não puder depender de `date-fns`, fazer a aritmética em string `YYYY-MM-DD`
(ano − 18, mesmo mês/dia, ajustando 29/02). É simples e não precisa de biblioteca.

### 2. Backend (`services/api`)

A checagem fica no **service** (decisão 2 precisa do valor gravado, que o DTO não tem):

- Helper `assertAdultBirthDate(next, previous?)` em `src/common/` (ou no módulo `resident`,
  exportado): se `next` é não nulo, diferente de `previous` e não adulto, lança
  `BadRequestException(MIN_AGE_MESSAGE)`.
- **`ResidentService`**: na criação (acolhimento manual) e no `update`, antes de persistir e antes
  de qualquer efeito colateral; na atualização de identidade (`UpdateResidentIdentityDto`); e na
  readmissão, se ela aceitar `birthDate`.
- **`ImportService.commit`** (import em lote): valida a `resident.birthDate` da ficha, porque
  passa por outro caminho que não o `create` do service. A recusa precisa chegar à etapa de revisão
  do import com a mensagem, para o operador corrigir uma data lida errada da ficha. Ver se o
  `match-extracted`/revisão já sinaliza a data para não descobrir só no commit (aviso na revisão,
  bloqueio no commit).
- **`StaffService`**: criação e `update` (inclui `update-staff-me`, se ele aceitar `birthDate`).
- Fora: `promote-to-servant` (decisão 8).

Sem migration. Sem rota nova. **Postman**: a resposta 400 nova documentada nas rotas de criação e
edição de filho e de servo e no commit do import.

### 3. `adm.fonte`

- Schemas zod que têm `birthDate` (`PersonalDataFields` / formulário de acolhimento,
  `EditResidentIdentityDialog`, `StaffPersonalTab` / cadastro de servo, revisão do import):
  `refine` com `isAdultBirthDate(v, todayInSaoPaulo())` e `MIN_AGE_MESSAGE`, aceitando vazio.
- Nas **edições**, o refine só dispara se o valor mudou em relação ao carregado (decisão 2). Senão,
  a tela bloquearia o que o backend aceita.
- Calendário: `max={maxBirthDateFor(today)}`.

### 4. `ops.fonte`

- **`AddResidentModal`** (contagem): mesma validação antes de enviar, com mensagem no campo e
  `maximumDate` no `DatePickerModal`. O fluxo é offline; o 400 do backend no replay cai em `/sync`
  com a mensagem (mecanismo existente). A validação local evita que o lançamento entre na fila já
  condenado.
- Nenhuma outra tela do `ops` edita nascimento.

---

## Validação

### `packages/types`

Unit de `maxBirthDateFor` / `isAdultBirthDate`:
- aniversário de 18 anos hoje → adulto;
- 18 anos amanhã → não adulto;
- nascido em 29/02 avaliado em ano não bissexto;
- `todayInSaoPaulo` às 23h30 de Brasília (já é o dia seguinte em UTC) devolve o dia de Brasília.

### Backend: `pnpm test:api`

- **Resident create**: 17 anos → 400 com `MIN_AGE_MESSAGE`; 18 anos hoje → passa; sem `birthDate`
  → passa.
- **Resident update**:
  - ficha gravada com menor + payload com a **mesma** data → passa (decisão 2);
  - payload alterando para menor → 400, sem `update` e sem efeitos colaterais;
  - payload sem `birthDate` → passa.
- **Update identity**: os mesmos três casos.
- **Import commit**: ficha com menor → recusa com a mensagem, nada persistido (transação); ficha
  adulta → segue igual.
- **Staff create/update**: mesmos casos do resident.
- **Promote-to-servant** com filho legado menor → passa (decisão 8).
- **Regressão**: specs existentes passam sem mudar a expectativa. Fixtures que usam nascimento de
  menor, ou datas relativas a "hoje" que viraram menores, são corrigidas para um adulto, e a
  correção é registrada no PR.

### Backend: `pnpm test:api:e2e`

- `POST` de filho e de servo com 17 anos → 400.
- `PATCH` mudando para menor → 400.
- `PATCH` sem mexer na data de uma ficha legada → 200.
- Fixtures próprias criadas via API e removidas no `afterAll`, limpeza por id (story 182).
  Atenção: o seed de teste não pode ter nascimento que vire menor com o passar dos anos. Usar datas
  fixas antigas.

### `adm.fonte`: unit (`pnpm test:adm:unit`)

- Schemas com o refine: menor → mensagem; adulto → ok; vazio → ok.
- Edição com valor carregado de menor e não alterado → submit liberado.
- Calendário com `max` correto.

### `adm.fonte`: e2e (`pnpm test:adm`)

Acolhimento com nascimento de 17 anos mostra o erro e não salva; com 18 salva.

### `ops.fonte`: unit (`pnpm test:ops:unit`)

`AddResidentModal`: menor → erro no campo e nenhuma mutation enfileirada; adulto → enfileira como
hoje.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov`, `pnpm test:adm:unit` e
`pnpm test:ops:unit` com cobertura: o helper de `@fonte/types` e o `assertAdultBirthDate` com 100%
dos ramos (criação, edição igual, edição diferente, nulo); sem reduzir a cobertura de `resident`,
`staff` e `import`. Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- **Tornar a data de nascimento obrigatória** (decisão 7).
- **Corrigir os cadastros antigos com menor**: no máximo, um relatório pontual; nada de migration
  que altere dados.
- **Idade na data de entrada** (alternativa descartada na decisão 3).
- **Familiares (`Relative`)**: podem ser menores; a regra é só para filho e servo.
- **Data de entrada no futuro / saída antes da entrada**: stories próprias do backlog.
