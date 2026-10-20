# Plan: criar e editar acolhimentos na aba Histórico do `adm.fonte`

## Context

Pedido do backlog: *"no app adm, adicionar funcionalidade de editar e criar os registros da aba
historico"*.

A aba **Histórico** (`features/residents/components/tabs/AdmissionsTab.tsx`) lista os acolhimentos
(`admissions`) do filho, só leitura. Ela aparece no detalhe do filho (`ResidentDetailPage`) e no
detalhe do servo ex-filho (`StaffDetailPage`, abas herdadas via `formerResidentId`). O backend só
tem `GET /residents/:id/admissions`. Hoje um acolhimento só nasce pelo cadastro, pela readmissão ou
pelo import em lote, e data/casa errada não tem como ser corrigida — nem passagem antiga que não
veio da ficha pode ser registrada.

### Decisões travadas (usuário)

1. **Campos editáveis: casa, entrada, saída e status.** Peso, altura, saúde, medicação e
   investimento familiar continuam no formulário do filho.
2. **Criar = só passagem antiga, já encerrada** (entrada + saída obrigatórias). Acolhimento novo e
   ativo continua sendo pelo fluxo de readmissão existente.
3. **Mesma aba vai receber os períodos de servo** (stories 216/217): o Histórico vira linha do tempo
   com acolhimentos e períodos de serviço. Esta story cuida só dos acolhimentos, mas o componente já
   nasce preparado para itens de mais de um tipo (decisão 9).
4. **Só ADMIN** cria e edita. COORDINATOR e SERVANT continuam só lendo.

### Decisões de desenho (defaults assumidos)

5. **Acolhimento atual (o aberto, mais recente) tem edição restrita**: só a **data de entrada**.
   Casa e status do acolhimento atual espelham `resident.house_id`/`resident.status`, que só mudam
   por transição validada em service (transferência, alta, readmissão — `BUSINESS_RULES.md`). Editar
   por aqui contornaria essa regra. Mudar a entrada do atual também atualiza `resident.entry_date`
   na mesma transação (o carnê usa o dia da entrada, `contributionDueDay`) — o recálculo de carnê
   **não** é feito aqui; fica o aviso na UI de que o carnê não muda.
6. **Acolhimentos encerrados**: casa, entrada, saída e status editáveis. Status aceito = só status
   de saída (`DISCHARGED`, `EVADED`, `ARCHIVED`… — conjunto exato dos status terminais já usados nas
   passagens; a implementação lê do enum e não inventa). Casa pode ser nula só se o status for
   `ARCHIVED` (mesma regra do filho).
7. **Datas seguem a story 203**: entrada não futura, saída não futura, `saída >= entrada`, com os
   helpers de `@fonte/types` (`todayInSaoPaulo`, `isFutureDate`) e as mesmas mensagens. Novo: **sem
   sobreposição** entre passagens do mesmo filho na criação e na edição (a 203 deixou isso fora só
   para o import). Mensagem: *"Este período se sobrepõe ao acolhimento de dd/mm/aaaa a dd/mm/aaaa."*
8. **Sem delete.** Remover passagem fica fora (decisão conservadora; histórico é fato). Se precisar
   depois, vira story própria com soft delete.
9. **UI**: botão "Adicionar acolhimento" no topo da aba e ícone de editar em cada card, visíveis só
   para ADMIN. Um `AdmissionFormDialog` (react-hook-form + zod) serve criar e editar; no atual
   mostra só o campo de entrada. Card extraído para `AdmissionCard` (a aba hoje renderiza inline),
   preparando a linha do tempo mista da 216.
10. **Auditoria**: escrita via `audit.track` (story 199), ações novas `ADMISSION_CREATE` /
    `ADMISSION_UPDATE`, target `ADMISSION` com o filho como principal.

### Dependências

- Stories 202/203 (helpers de data) já na main.
- **216** (período de servo no histórico) vem depois e reaproveita `AdmissionCard`/a aba.

---

## Desenho

### 1. Backend (`services/api`)

- `POST /residents/:id/admissions` — `@Roles(ADMIN)`, `CreateAdmissionDto`
  (`houseId?`, `entryDate`, `exitDate`, `status`), todos com `class-validator`.
- `PATCH /residents/:id/admissions/:admissionId` — `@Roles(ADMIN)`, `UpdateAdmissionDto` (mesmos
  campos, opcionais). Admission de outro filho → 404.
- `ResidentService` (ou `AdmissionService` dentro do módulo resident, se o arquivo já passou do
  ponto): `createAdmission` / `updateAdmission` com as regras das decisões 5–7, numa transação com
  auditoria. Identificar "atual" = acolhimento sem `exit_date` mais recente (mesma regra que a
  readmissão usa hoje — reaproveitar, não reescrever).
- Sem migration (colunas existem).
- **Postman**: os dois endpoints novos com exemplos de body e erros (400 datas, 400 sobreposição,
  400 campo proibido no atual, 403 não-admin).

### 2. Contratos

- `@fonte/types`: `CreateAdmissionPayload`, `UpdateAdmissionPayload`.
- `@fonte/api-client`: `residents.createAdmission(residentId, payload)` e
  `residents.updateAdmission(residentId, admissionId, payload)`.
- `pnpm build:types` / `pnpm build:api-client`.

### 3. `adm.fonte`

```
features/residents/
  hooks/useResidents.ts               ← useCreateAdmission, useUpdateAdmission (invalidam
                                        queryKeys.residents.admissions + detail do filho)
  components/tabs/AdmissionsTab.tsx   ← orquestra lista + botão adicionar (ADMIN)
  components/AdmissionCard.tsx        ← card extraído, ícone editar (ADMIN)
  components/AdmissionFormDialog.tsx  ← criar/editar, zod com as regras de data + sobreposição
```

- Gate de role via `useAuth` (ADMIN). Erros com `getErrorMessage`.
- Funciona igual no `StaffDetailPage` (mesma aba, `formerResidentId`).

---

## Validação

### Backend: `pnpm test:api`

- Criar: passagem encerrada válida → salva; sem saída → 400; entrada futura / saída futura / saída <
  entrada → 400 com as mensagens da 203; sobreposição com passagem existente → 400; casa nula com
  status ≠ ARCHIVED → 400; status não terminal → 400.
- Editar encerrado: muda casa/datas/status; sobreposição com *outra* passagem → 400 (ela mesma não
  conta).
- Editar atual: só `entryDate` aceito (outro campo → 400); atualiza `resident.entry_date` junto.
- Admission de outro filho → 404. Auditoria gravada nas duas ações.

### Backend: `pnpm test:api:e2e`

- ADMIN cria e edita passagem → 201/200; COORDINATOR e SERVANT → 403.
- Fixture própria (filho criado via API + passagens), removida no `afterAll`, limpeza por id
  (story 182).

### `adm.fonte`: unit (`pnpm test:adm:unit`)

- `AdmissionFormDialog`: validações zod (datas, saída obrigatória na criação, só entrada no atual).
- `AdmissionsTab`/`AdmissionCard`: botões visíveis só para ADMIN.
- Hooks: invalidam as query keys certas.

### `adm.fonte`: Playwright (`pnpm test:adm`)

- Como ADMIN: adicionar passagem antiga a um filho de fixture, editar a data de saída, ver o card
  atualizado; tentativa com sobreposição mostra o erro.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` sem reduzir a cobertura de `resident`;
métodos novos ≥90%. `pnpm test:adm:unit` com cobertura: dialog, card e hooks novos ≥90%. Sem
`skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- Excluir acolhimento (decisão 8).
- Editar peso/altura/saúde/investimento pela aba (decisão 1).
- Criar acolhimento ativo (é a readmissão).
- Recalcular carnê ao mudar a entrada do acolhimento atual.
- Períodos de servo (stories 216/217).
- Edição pelo `ops.fonte`.
