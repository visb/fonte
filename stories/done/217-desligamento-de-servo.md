# Plan: processo de desligamento (e reintegração) de servo

## Context

Pedido do backlog: *"criar processo de desligamento de servo"*.

Hoje "desligar" é o `DELETE /staff/:id` (`@Roles(ADMIN)`, `StaffService.remove`): soft delete do
`Staff` e do `User`, `is_active = false` e limpeza do titular da casa (story 194). O servo some de
todas as telas, o detalhe dá 404 e o Histórico dele (acolhimentos da 215 + períodos da 216) fica
inacessível. Não se registra **quando** nem **por que** a pessoa saiu.

### Decisões travadas (usuário)

1. **Cadastro fica visível como "Desligado"**, sem soft delete. Coluna nova `staff.dismissed_at`.
   Desligado sai das listas, contagens e seletores de servo **ativo**, mas aparece num filtro
   "Desligados" na lista de servos do `adm`, e o detalhe (com o Histórico) continua acessível.
   O `User` é desativado (`is_active = false`, login bloqueado), **não** soft-deletado.
2. **Motivo = categoria + observação**. Enum `StaffDismissalReason`: `OWN_REQUEST` (Pedido
   próprio), `COORDINATION_DECISION` (Decisão da coordenação), `TRANSFER_OTHER_WORK`
   (Transferência para outra obra), `DEATH` (Falecimento), `OTHER` (Outro) + observação livre
   opcional (obrigatória quando `OTHER`).
3. **Reintegração entra**: ADMIN reintegra o desligado — reativa o `User`, limpa `dismissed_at`
   e abre um **novo** período de serviço (casa + data de início).
4. **Só ADMIN, só no `adm.fonte`.**

### Decisões de desenho (defaults assumidos)

5. **Motivo mora no período encerrado.** `staff_service_periods` (216) ganha `end_reason`
   (enum, nullable) e `end_notes` (text, nullable). Desligar = fechar o período aberto
   (`end_date` = data do desligamento, motivo, observação) + `staff.dismissed_at` = mesma data, numa
   transação. O Histórico mostra o motivo no card do período encerrado. Período encerrado
   manualmente pela edição da 216 continua sem motivo (campos opcionais).
6. **Data do desligamento** informada no dialog (default hoje), não futura, `>=` início do período
   aberto (regras da 203/216). Reintegração: data de início não futura e `>=` fim do último
   período.
7. **Efeitos colaterais do desligamento (mesma transação):**
   - limpa titular da casa (`clearTitular`, como o `remove` atual);
   - tira a liderança de ministérios (`leader_type = 'STAFF' AND leader_id = staff`), como a
     promoção faz com filho (story 205);
   - permissões extras (`staff_permissions`) **ficam** gravadas mas são inertes com o User inativo;
     na reintegração voltam. (Sem perder configuração; default conservador.)
   - `house_id` e `rank` **ficam** (registro do último estado).
8. **"Ativo" = `deleted_at IS NULL AND dismissed_at IS NULL`.** A implementação varre as queries de
   staff que hoje filtram só `deleted_at` (lista de servos, `findStaffForHouse`, contagem de staff
   da casa, `findCoordinators`, seletores de líder/responsável, grupos de apoio, notificações) e
   centraliza o predicado (helper/QueryBuilder scope), em vez de repetir à mão. A lista de
   coordenadores da casa e a elegibilidade de titular excluem desligado.
9. **`DELETE /staff/:id` continua** para cadastro feito por engano (comportamento atual), mas na UI
   vira ação secundária "Excluir cadastro" com confirmação forte; a ação principal passa a ser
   **"Desligar"**.
10. **Legado**: staff já soft-deletado antes desta story **não** é migrado (continua oculto).
    Backfill da 216 já ignora soft-deletado, então não há período aberto pendente para eles.
11. **Endpoints**: `POST /staff/:id/dismiss` (`DismissStaffDto`: `date`, `reason`, `notes?`) e
    `POST /staff/:id/reinstate` (`ReinstateStaffDto`: `date`, `houseId?`), ambos
    `@Roles(ADMIN)`. Desligar já desligado / reintegrar ativo → 409. `GET /staff` aceita
    `?status=active|dismissed` (default `active`). Auditoria `STAFF_DISMISS` / `STAFF_REINSTATE`.
12. **`ops.fonte`**: nada a fazer além do efeito do predicado (servo desligado some da tela Servos
    e dos seletores). Login bloqueado pelo `is_active` já existente; sessão aberta cai no próximo
    401 normal.

### Dependências

- **Depende da 216** (`staff_service_periods`). Toca a regra de coordenadores da **214**: quem vier
  depois rebaseia o predicado (coordenador = role COORDINATOR|ADMIN **e** ativo).

---

## Desenho

### 1. Backend (`services/api`)

- Migration nova: `staff.dismissed_at` (date null); `staff_service_periods.end_reason` (enum) e
  `end_notes` (text). Enum em `@fonte/types` (`StaffDismissalReason`).
- `StaffService.dismiss` / `reinstate` (decisões 5–7), predicado de ativo centralizado (8).
- `StaffController`: rotas da decisão 11; `findAll` com filtro de status.
- Ajustar todas as queries de staff ativo (decisão 8).
- **Postman**: `dismiss`, `reinstate`, `GET /staff?status=`; resposta do staff com `dismissedAt`.
- `BUSINESS_RULES.md`: seção "Desligamento de servo" (motivos, efeitos, reintegração; DELETE só
  para cadastro errado).

### 2. Contratos

- `@fonte/types`: `StaffDismissalReason` + labels pt-BR, `dismissedAt` em `Staff`, `endReason`/
  `endNotes` em `StaffServicePeriod`, payloads de dismiss/reinstate.
- `@fonte/api-client`: `staff.dismiss`, `staff.reinstate`, `staff.list({ status })`.
- `pnpm build:types` / `pnpm build:api-client`.

### 3. `adm.fonte`

```
features/staff/
  hooks/useStaff.ts                  ← useDismissStaff, useReinstateStaff; useStaff({ status })
  components/DismissStaffDialog.tsx  ← RHF + zod: data, motivo, observação (obrigatória se OTHER)
  components/ReinstateStaffDialog.tsx← data + casa
  components/StaffStatusFilter.tsx   ← Ativos | Desligados na lista
  components/ServicePeriodCard.tsx   ← mostra motivo/observação no período encerrado
constants.ts                         ← labels dos motivos
```

- `StaffDetailPage`: badge "Desligado" + data; botão "Desligar" (ativo) / "Reintegrar" (desligado);
  "Excluir cadastro" secundário. Desligado não mostra "Resetar senha".
- Invalidação: detalhe, lista, períodos, casa (contagem/coordenadores), ministérios.

---

## Validação

### Backend: `pnpm test:api`

- Desligar: fecha período aberto com data/motivo, grava `dismissed_at`, desativa User sem soft
  delete, limpa titular e liderança de ministério — tudo ou nada (falha no meio desfaz).
- Data futura / anterior ao início do período → 400; `OTHER` sem observação → 400; já desligado → 409.
- Reintegrar: reativa User, limpa `dismissed_at`, abre período novo; data antes do fim do último
  período → 400; ativo → 409.
- Predicado de ativo: desligado fora de `findStaffForHouse`, `findCoordinators`, contagem da casa,
  `GET /staff` default; dentro de `GET /staff?status=dismissed`. Titular não pode ser desligado.
- Login de desligado → 401.

### Backend: `pnpm test:api:e2e`

- Ciclo ADMIN: desligar → `GET /staff/:id` 200 com `dismissedAt` → reintegrar → dois períodos no
  histórico. COORDINATOR/SERVANT → 403 nas duas rotas.
- Fixture própria (staff criado via API), removida no `afterAll`, limpeza por id (story 182).

### `adm.fonte`: unit (`pnpm test:adm:unit`) + Playwright (`pnpm test:adm`)

- `DismissStaffDialog` / `ReinstateStaffDialog`: validações zod.
- `StaffDetailPage`: botões certos por estado; badge "Desligado".
- Filtro Ativos/Desligados.
- E2E: desligar servo de fixture, achar no filtro "Desligados", abrir Histórico com motivo,
  reintegrar.

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- Só se algum filtro client-side de staff for tocado; senão, regressão via e2e da API.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` sem reduzir a cobertura de `staff`,
`house`, `ministry`; código novo ≥90%. `pnpm test:adm:unit` com cobertura dos dialogs/filtro/hooks
novos ≥90%. Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- Desligar pelo `ops.fonte` (decisão 4).
- Migrar/restaurar staff soft-deletado antes desta story (decisão 10).
- Ex-filho desligado voltar a ser filho (é readmissão do Resident, fluxo próprio).
- Notificar a casa/família sobre o desligamento.
- Relatório de desligamentos por motivo.
