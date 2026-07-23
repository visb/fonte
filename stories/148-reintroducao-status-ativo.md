# Plan: Reintrodução — filho volta com status ATIVO, não PRE_ADMISSION

## Context

Bloco **App adm → Reintrodução de acolhido** do BACKLOG. Mesmo fluxo das stories 146 e 147.

Ao reintroduzir um filho (status Alta/Evasão → novo acolhimento), ele hoje volta com status
`PRE_ADMISSION`. Como é um retorno de alguém já conhecido pela casa, deveria entrar já `ACTIVE`,
sem passar pela fase de pré-admissão.

Levantamento do planning — `resident.service.ts` `readmit()` (`resident.service.ts:372`):

- Grava `status: 'PRE_ADMISSION'` **em dois lugares**: no novo registro de `admission` (linha 399) e
  no próprio `resident` (linha 417). Ambos precisam virar `ACTIVE`.
- O fluxo normal PRE→ACTIVE acontece no `update()` e dispara `notifyAdmissionCreated`
  (`resident.service.ts:276` e :312) — "Acolhimento concluído / X agora está ativo". O `readmit`
  **não** passa por esse caminho.
- `readmit` já cria o follow-up `READMISSION` (linha 410) e já chama
  `receivableService.generateSchedule(id)` (linha 443) — o carnê é gerado independente do status.

Decisões travadas com o usuário:

- Reintrodução entra direto como **`ACTIVE`** (resident e admission).
- **Disparar** a notificação "acolhimento concluído / X agora está ativo" (mesma do fluxo normal
  PRE→ACTIVE), para consistência — a equipe vê que o filho voltou ativo. Reusar
  `notifyAdmissionCreated`.

Regra de negócio (BUSINESS_RULES): "Status de Resident só muda por transição validada em service" —
a mudança fica contida no `readmit` do service, sem exigir passo extra de pré-admissão. `house_id`
é obrigatório fora de `ARCHIVED`, e o form já obriga `houseId` — coerente com `ACTIVE`.

## Desenho

1. Em `readmit()`, trocar `status: 'PRE_ADMISSION'` → `status: 'ACTIVE'` no `admissionRepository.create`
   (linha 399) e no `residentUpdate` (linha 417).
2. Após o `residentRepository.update`, chamar `notifyAdmissionCreated(resident)` (best-effort, como
   no `update`) para emitir a notificação de acolhimento concluído.
3. Conferir que a ordem de efeitos (follow-up READMISSION, generateSchedule, emitCountsChanged) segue
   coerente com o filho já `ACTIVE` — `emitCountsChanged` já é chamado e a contagem por casa passa a
   incluir o reintroduzido (esperado, pois voltou presente).

Escopo backend-only (`services/api`). Sem mudança de contrato/DTO; sem migration.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Gate: **código novo sem teste
não fecha a story** — `pnpm test:api:cov` verde, cobertura ≥90 do código tocado.

- **API unit** (`resident.service.spec.ts`, bloco `readmit`):
  - após `readmit`, o `resident` retornado tem `status === ACTIVE` (não `PRE_ADMISSION`);
  - o registro de `admission` criado é salvo com `status: 'ACTIVE'`;
  - `notifyAdmissionCreated` / `notifications.create` é chamado uma vez com o tipo
    `ADMISSION_CREATED`;
  - segue criando o follow-up `READMISSION` e chamando `generateSchedule` (não regredir).
- **API e2e** (se já houver spec de readmissão): reintroduzir um filho `DISCHARGED`/`EVADED` →
  resposta com `status: ACTIVE`.

## Fora de escopo

- Exibição do CPF (story 146) e edição de identidade (story 147).
- Alterar o fluxo de admissão normal (novo filho continua entrando em `PRE_ADMISSION`).
- Regras de contribuição/carnê além do `generateSchedule` já existente.
