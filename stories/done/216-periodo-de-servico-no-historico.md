# Plan: período de serviço do servo no Histórico

## Context

Pedido do backlog: *"quando um filho é promovido a servo, criar um registro no historico com data de
inicio e fim (vazio como valor inicial)"*.

Hoje `ResidentService.promoteToServant` cria o `Staff` (`promoted_at`, `former_resident_id`), dá
alta no filho (DISCHARGED, `exit_date` = data da promoção) e grava o follow-up
`PROMOTED_TO_SERVANT`. Não existe registro de **período de serviço**: não há como saber de quando
até quando alguém serviu, nem em que casa. A aba **Histórico** do servo
(`StaffDetailPage`) só existe para ex-filho e mostra os acolhimentos dele como filho.

### Decisões travadas (usuário)

1. **Mesma aba Histórico** (decidido na story 215): a aba vira linha do tempo com dois tipos de
   item — *acolhimento* (fase de filho) e *período de serviço* (fase de servo).
2. **Todo servo tem período**, não só o ex-filho: o período nasce na promoção **e** no cadastro
   direto de servo. A aba Histórico passa a existir para todo servo.
3. **Backfill**: migration cria um período **aberto** para cada staff existente não desligado
   (início = `promoted_at` ou, sem ele, `created_at::date`; casa = `house_id` atual).
4. **Editável na aba, só ADMIN**: criar período antigo já encerrado; editar início/fim/casa de
   período encerrado; período **aberto** só edita o início (o fim é escrito pelo desligamento,
   story 217).

### Decisões de desenho (defaults assumidos)

5. **"Servo" = todo `Staff`** (SERVANT, COORDINATOR, ADMIN), como a tela de servos do `adm` já
   trata. Período não guarda role nem rank (fora de escopo).
6. **Tabela `staff_service_periods`**: `id` uuid, `staff_id` (FK, cascade), `house_id` (nullable —
   servo de grupo de apoio não tem casa), `start_date` date not null, `end_date` date null,
   `created_at`/`updated_at`/`deleted_at`. **No máximo um período aberto por staff**: índice único
   parcial `(staff_id) WHERE end_date IS NULL AND deleted_at IS NULL`.
7. **Regras de data** (mesmas da 203/215): início não futuro, fim não futuro, `fim >= início`, sem
   sobreposição entre períodos do mesmo staff. Mensagens no mesmo tom das da 215.
8. **Promoção**: período criado **na mesma transação** de `createFromResident`, início =
   `promotedAt`, casa = casa do staff. **Cadastro direto**: início = data de hoje
   (`todayInSaoPaulo`) — o form de criação de servo não ganha campo novo nesta story.
9. **Mudança de casa do staff** (`StaffService.update` com `houseId` novo) **não** fecha/abre
   período nesta story — o período registra a casa de início; transferência entre casas fica fora.
10. **Leitura**: `GET /staff/:id/service-periods` (ADMIN, COORDINATOR, SERVANT — mesmo acesso do
    detalhe do staff), ordenado por início desc. Escrita: `POST /staff/:id/service-periods` e
    `PATCH /staff/:id/service-periods/:periodId`, `@Roles(ADMIN)`. Sem delete (mesma postura da
    215). Auditoria via `audit.track` (`STAFF_SERVICE_PERIOD_CREATE/UPDATE`).
11. **Linha do tempo no `adm`**: no `StaffDetailPage`, a aba **Histórico** sai das abas herdadas e
    vai para as abas base. Ela mistura os acolhimentos do ex-filho (`formerResidentId`, cards da
    215) e os períodos de serviço, ordenados por data de início desc. Card próprio
    `ServicePeriodCard` (rótulo "Período de serviço", casa, início, fim ou "Em andamento"). No
    `ResidentDetailPage` a aba continua só com acolhimentos.

### Dependências

- **Depende da 215** (`AdmissionCard`, `AdmissionFormDialog`, padrão de edição só-ADMIN na aba).
- **217** (desligamento de servo) fecha o período aberto.

---

## Desenho

### 1. Backend (`services/api`)

- Migration nova `CreateStaffServicePeriods`: tabela + índice parcial + backfill (decisão 3).
- Entity `StaffServicePeriod` no módulo `staff`.
- `StaffService`: `createFromResident` e `create` abrem o período na mesma transação;
  `findServicePeriods`, `createServicePeriod`, `updateServicePeriod` com as regras 4/6/7.
- `StaffController`: as três rotas da decisão 10, DTOs com `class-validator`.
- **Postman**: três endpoints novos com exemplos e erros.
- `BUSINESS_RULES.md`: seção de período de serviço (um aberto por vez, nasce na promoção/cadastro).

### 2. Contratos

- `@fonte/types`: `StaffServicePeriod`, `CreateServicePeriodPayload`, `UpdateServicePeriodPayload`.
- `@fonte/api-client`: `staff.listServicePeriods`, `staff.createServicePeriod`,
  `staff.updateServicePeriod`. `pnpm build:types` / `pnpm build:api-client`.

### 3. `adm.fonte`

```
features/staff/
  hooks/useStaff.ts                      ← useStaffServicePeriods, useCreateServicePeriod,
                                           useUpdateServicePeriod (queryKeys.staff.servicePeriods)
  components/StaffHistoryTab.tsx         ← linha do tempo mista (acolhimentos + períodos)
  components/ServicePeriodCard.tsx
  components/ServicePeriodFormDialog.tsx ← RHF + zod; período aberto só edita início
lib/queryKeys.ts                         ← staff.servicePeriods(id)
```

- `StaffDetailPage`: aba Histórico nas `BASE_TABS`, renderiza `StaffHistoryTab`.
- Botões de adicionar/editar só para ADMIN.

---

## Validação

### Backend: `pnpm test:api`

- Promoção cria período aberto com início = `promotedAt` e casa do staff, na mesma transação
  (falha no período desfaz a promoção).
- Cadastro direto cria período aberto com início = hoje.
- Criar período encerrado válido; sem fim → 400; datas futuras / fim < início → 400; sobreposição
  → 400; segundo período aberto → 400 (mensagem amigável, não erro cru do índice).
- Editar aberto: só início (fim/casa → 400). Editar encerrado: início/fim/casa.
- Período de outro staff → 404.

### Backend: migration

- `pnpm --filter api migration:run:test` sobe; backfill cria um período aberto por staff não
  desligado, com início = `promoted_at` quando houver.

### Backend: `pnpm test:api:e2e`

- Promover filho de fixture → `GET /staff/:id/service-periods` traz período aberto.
- ADMIN cria/edita → 201/200; COORDINATOR/SERVANT escrevendo → 403; lendo → 200.
- Fixtures próprias, removidas no `afterAll`, limpeza por id (story 182).

### `adm.fonte`: unit (`pnpm test:adm:unit`) + Playwright (`pnpm test:adm`)

- `StaffHistoryTab`: ordena acolhimentos e períodos juntos; servo direto só períodos; "Em andamento"
  para período aberto.
- `ServicePeriodFormDialog`: validações zod; período aberto mostra só início.
- Botões só para ADMIN.
- E2E: detalhe de servo de fixture mostra a aba Histórico com o período; ADMIN adiciona período
  antigo.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` sem reduzir a cobertura de `staff` e
`resident`; código novo ≥90%. `pnpm test:adm:unit` com cobertura dos componentes/hooks novos ≥90%.
Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- Fechar o período (desligamento — story 217).
- Abrir/fechar período ao transferir servo de casa (decisão 9).
- Guardar role/rank no período; histórico de promoção de nível.
- Delete de período.
- Exibir períodos no `ops.fonte`.
