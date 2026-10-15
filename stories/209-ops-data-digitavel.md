# Plan: campos de data digitáveis no `ops.fonte`

## Context

Na contagem (`AddResidentModal`), "Data de acolhimento" e "Data de nascimento" são botões que só
abrem o calendário (`DatePickerModal`). Para uma data de nascimento de 40 anos atrás, isso significa
navegar mês a mês ou ano a ano, um passo lento e propenso a erro. Backlog: *"no app ops, ao
adicionar um filho na contagem, os campos de data precisam ser editáveis através da digitação, não
só pelo calendário como é hoje"*.

Todos os campos de data do `ops` têm o mesmo problema, cada um com sua implementação:

- `features/census/components/AddResidentModal.tsx`: acolhimento + nascimento (`DatePickerModal`);
- `features/residents/components/RemoveResidentModal.tsx`: data de saída;
- `features/storeroom/components/DateField.tsx` e `features/supply-room/components/DateField.tsx`:
  cópias quase idênticas (`WheelDatePickerModal`, valor `Date`);
- `features/street-sales/pages/NewStreetSalePage.tsx` / `EditStreetSalePage.tsx`;
- `features/support-groups/components/CreateMeetingModal.tsx`.

(Conferir na implementação se há outro campo de data. O critério é qualquer campo que hoje só
abre picker.)

### Decisões travadas (usuário)

1. **Componente compartilhado, adotado em todo o `ops`**: um `DateInput` em
   `components/shared/` substitui todos os campos de data listados acima, não só o da contagem.
2. **Validação: data real e não futura.**
   - O texto digitado precisa formar uma data existente (`31/02/2020` é rejeitado).
   - Na contagem, acolhimento e nascimento **não podem ser no futuro**, e o **nascimento não pode
     ser depois do acolhimento**.
3. **Filho maior de idade (contagem).** No cadastro pela contagem, o nascimento informado precisa
   dar **18 anos ou mais**. A idade é calculada **na data de acolhimento** (default do refino: se o
   acolhimento é hoje, equivale a hoje). Conta aniversário exato: quem faz 18 no próprio dia do
   acolhimento passa. Mensagem: "O filho precisa ter 18 anos ou mais na data de acolhimento". O
   nascimento continua opcional, e sem ele não há checagem. A regra fica só no schema do
   `AddResidentModal`: o backend e o acolhimento do `adm` ficam fora.

### Decisões de desenho (defaults assumidos no refino)

4. **`DateInput`**: `TextInput` com máscara `dd/mm/aaaa` (`keyboardType="number-pad"`, barras
   inseridas automaticamente, máx. 10 caracteres) e um ícone de calendário à direita que abre o
   picker. O picker continua como alternativa.
   - **Valor**: string ISO `yyyy-mm-dd`, ou `''` quando vazio/incompleto. É o contrato que os
     forms já usam com o `DatePickerModal`.
   - Escolher no picker preenche o texto, e digitar uma data válida atualiza o picker.
   - Props: `value`, `onChange(iso)`, `onBlur`, `maxDate?`, `minDate?`, `placeholder?`,
     `error?`, `accessibilityLabel`.
   - Texto incompleto ou inválido não chama `onChange` com ISO. O form recebe `''` e o zod reporta.
     A mensagem de erro vem do schema do form (react-hook-form + zod), não do componente.
5. **Um picker só**: o `DateInput` usa o `DatePickerModal` (calendário). As duas cópias de
   `DateField` (storeroom/supply-room) são removidas. Se o `WheelDatePickerModal` ficar sem uso,
   sai também, com seus testes.
6. **Regra de futuro por tela** (default):
   - **não futura**: contagem (acolhimento, nascimento), remover filho (saída), almoxarifado,
     despensa e venda de rua (lançamento retroativo sim, futuro não);
   - **futura permitida**: reunião de grupo de apoio (agenda-se reunião).

   Cada regra fica no schema zod da tela. O `maxDate` do `DateInput` só limita o picker.
7. **Utilitários de data num lugar só**: `lib/date.ts` (ou o existente) com `parseBrDate`
   (`dd/mm/aaaa` → ISO ou `null`), `formatIsoToBr`, `isFutureIso`, `ageAt(birthIso, refIso)`. Saem as cópias locais
   (`formatDate` do `AddResidentModal`, `formatDateDisplay`, `toISODate` duplicados), mantendo os
   usos que forem de outra natureza.
8. **Fuso**: "hoje" é a data local do aparelho, não `toISOString()` em UTC, que vira o dia
   depois das 21h no Brasil. Corrigir o `todayIso` do `AddResidentModal` junto.
9. **Offline intacto**: nenhuma mudança em mutations, payloads ou fila. Os forms continuam mandando
   a mesma string ISO.
10. **Tamanho**: o `AddResidentModal` (~370 linhas) já passa do limite de ~150. Como ele é tocado,
   os campos de data e `Field`/`GenderOption` saem para componentes próprios da feature.

---

## Desenho (`ops.fonte`, frontend-only)

```
components/shared/DateInput.tsx      ← máscara + ícone + DatePickerModal
lib/date.ts                          ← parseBrDate, formatIsoToBr, isFutureIso, todayLocalIso
features/census/components/
  AddResidentModal.tsx               ← usa DateInput; schema: não-futuro, nascimento ≤ acolhimento, 18+ no acolhimento
  AddResidentFields.tsx (ou similar) ← quebra do modal
features/residents/components/RemoveResidentModal.tsx
features/storeroom/pages/MovementPage.tsx      ← DateInput no lugar de DateField
features/supply-room/pages/MovementPage.tsx    ← idem
features/street-sales/pages/New/EditStreetSalePage.tsx
features/support-groups/components/CreateMeetingModal.tsx
```

Removidos: `features/storeroom/components/DateField.tsx`,
`features/supply-room/components/DateField.tsx` (e `WheelDatePickerModal` se ficar órfão).

Nas telas cujo valor de data hoje é `Date` (storeroom/supply-room), o form passa a guardar a ISO
string. A conversão para o payload fica igual ao que já vai para a API.

---

## Validação

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- **`lib/date`**:
  - `parseBrDate` aceita `05/03/1985` → `1985-03-05`;
  - rejeita `31/02/2020`, `00/01/2020`, `12/13/2020`, texto incompleto e não numérico;
  - `isFutureIso` com relógio mockado (inclui a virada do dia em horário local, decisão 8);
  `ageAt` na véspera, no dia e no dia seguinte ao 18º aniversário, incluindo nascimento em 29/02.
- **`DateInput`**:
  - digitar `05031985` exibe `05/03/1985` e chama `onChange('1985-03-05')`;
  - apagar ou deixar incompleto chama `onChange('')`;
  - o ícone abre o picker, e escolher no picker atualiza o texto e chama `onChange`;
  - `value` inicial ISO aparece formatado;
  - `error` aparece.
- **`AddResidentModal`**:
  - submit com datas digitadas manda a ISO certa;
  - acolhimento futuro → erro;
  - nascimento futuro → erro;
  - nascimento depois do acolhimento → erro;
  - data inválida → erro;
  - sem nascimento continua aceito (opcional);
  - **maioridade**:
    - 17 anos e 364 dias na data de acolhimento → erro com a mensagem;
    - 18 anos exatos no dia do acolhimento → aceito;
    - acolhimento retroativo: a idade é calculada nessa data, não hoje.
- **Cada tela migrada** (remover filho, almoxarifado, despensa, venda de rua nova/edição, reunião):
  - a data digitada chega ao payload;
  - data futura rejeitada onde a regra vale;
  - reunião aceita data futura.
  - Atualizar os testes existentes que usavam `DateField`/`WheelDatePickerModal`
    (`StoreroomComponents.test.tsx`, `SupplyRoomComponents.test.tsx`, `SupplyRoomFields.test.tsx`,
    `SupportGroupComponents.test.tsx`, `RemoveResidentModal.test.tsx`, `CensusComponents.test.tsx`,
    `WheelDatePickerModal.test.tsx`, `SharedComponents.test.tsx`) sem perder caso coberto.
- **Offline**: os testes de `mutationDefaults`/fila da contagem e do almoxarifado continuam verdes.
  O payload não muda.

### `ops.fonte`: Maestro (`pnpm test:ops`)

- `e2e/census.yaml`: adicionar filho **digitando** as datas de acolhimento e nascimento, e conferir o
  filho na lista.
- `e2e/storeroom.yaml`: lançamento com data digitada.
- A limpeza segue a story 182 (fixture própria, removida por id).

### `ops.fonte`: offline e2e (Playwright web, `e2e-web/`)

- `offline-field-flows.spec.ts`: o fluxo offline de adicionar filho na contagem, com datas
  digitadas, entra na fila e sincroniza com a data certa.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:ops:unit` com cobertura: `DateInput` e
`lib/date` ≥90%, e as features tocadas sem reduzir. Sem `skip`/`only`/`xfail` sem justificativa
explícita no código (CLAUDE.md).

---

## Fora de escopo

- `adm.fonte`, `app.fonte` e `portal.fonte`.
- Campos de **hora** (só data).
- Mudança de backend ou de validação no servidor. A regra "não futura" é de UX no `ops`, e o backend
  segue como está.
- Trocar a lib de calendário.
- **Maioridade no backend ou no acolhimento do `adm`**: a regra dos 18 anos é só da contagem no
  `ops` (decisão 3).
