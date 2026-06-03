# Story 08 — Timeline de Acompanhamento

## Contexto

Registrar e visualizar eventos durante o tratamento do interno, do acolhimento ao desligamento. Afeta **ops.fonte** (operadores registram + visualizam) e **adm.fonte** (gestão completa). Família **não** tem acesso à timeline.

A aba "Acompanhamento" já existe como placeholder em ambos os apps — esta story a implementa.

---

## Nova entidade: `ResidentFollowUp`

Tabela `resident_follow_ups`.

| Campo                                | Tipo                     | Notas                         |
| ------------------------------------ | ------------------------ | ----------------------------- |
| id                                   | UUID PK                  |                               |
| resident_id                          | UUID FK → residents      |                               |
| date                                 | date                     | data do evento                |
| type                                 | enum FollowUpType        |                               |
| description                          | text nullable            | texto livre                   |
| access_level                         | enum FollowUpAccessLevel | ALL \| ADMINISTRATION         |
| created_by_id                        | UUID FK → staff nullable | null = gerado automaticamente |
| created_at / updated_at / deleted_at | timestamps               | soft delete                   |

---

## Enums (packages/types)

```ts
enum FollowUpType {
  ADMISSION = "ADMISSION",
  READMISSION = "READMISSION",
  DISCHARGE = "DISCHARGE",
  EVASION = "EVASION",
  MINISTRY_CHANGE = "MINISTRY_CHANGE",
  RELATIVE_ADDED = "RELATIVE_ADDED",
  DOCUMENT_ATTACHED = "DOCUMENT_ATTACHED",
  MONTHLY_CONTRIBUTION = "MONTHLY_CONTRIBUTION",
  DISCIPLINE = "DISCIPLINE",
  BEHAVIOR_ASSESSMENT = "BEHAVIOR_ASSESSMENT",
  NOTE = "NOTE",
}

enum FollowUpAccessLevel {
  ALL = "ALL", // toda a staff: ADMIN, COORDINATOR, SERVANT
  ADMINISTRATION = "ADMINISTRATION", // só ADMIN
}
```

---

## Controle de acesso

| Nível            | SERVANT/COORDINATOR | ADMIN |
| ---------------- | -------------------- | ----- |
| `ALL`            | ✅                   | ✅    |
| `ADMINISTRATION` | ❌                   | ✅    |

---

## Eventos automáticos

| Gatilho                                          | Tipo              | Access Level padrão |
| ------------------------------------------------ | ----------------- | ------------------- |
| `ResidentService.create()`                       | ADMISSION         | ALL                 |
| `ResidentService.readmit()`                      | READMISSION       | ALL                 |
| `ResidentService.update()` — status → DISCHARGED | DISCHARGE         | ALL                 |
| `ResidentService.update()` — status → EVADED     | EVASION           | ALL                 |
| `ResidentService.update()` — ministryId muda     | MINISTRY_CHANGE   | ALL                 |
| `ResidentService.addAttachment()`                | DOCUMENT_ATTACHED | ALL                 |
| `RelativeService.create()`                       | RELATIVE_ADDED    | ALL                 |

Para detectar mudanças em `update()`: comparar `dto` com resultado do `findOne()` já chamado antes.

---

## Backend (`services/api`)

### Novo módulo `resident-follow-up`

```
src/modules/resident-follow-up/
  resident-follow-up.entity.ts
  resident-follow-up.service.ts       ← findByResident(residentId, role), create(), createAuto()
  resident-follow-up.module.ts        ← exporta ResidentFollowUpService
  dto/
    create-follow-up.dto.ts           ← date, type, description?, accessLevel
```

`findByResident(residentId, role)`:

- `Role.SERVANT` → filtrar só `accessLevel = ALL`
- `Role.ADMIN | COORDINATOR` → retornar tudo
- Ordenar por `date DESC, createdAt DESC`
- Join com staff (created_by) para retornar `createdByName`

### Migration

Nova migration: cria tabela `resident_follow_ups` com FK para `residents` e `staff`.

### Endpoints em `resident.controller.ts`

```
GET  /residents/:id/follow-ups   roles: ADMIN, COORDINATOR, SERVANT
POST /residents/:id/follow-ups   roles: ADMIN, COORDINATOR, SERVANT
```

POST extrai `staffId` do JWT via `@CurrentUser()` → `createdById`.

### Injeções de dependência

- `ResidentModule` importa `ResidentFollowUpModule` → injeta `ResidentFollowUpService` no `ResidentService`
- `RelativeModule` importa `ResidentFollowUpModule` → injeta `ResidentFollowUpService` no `RelativeService`

---

## packages/types

Adicionar em `packages/types/src/index.ts`:

- `enum FollowUpType`
- `enum FollowUpAccessLevel`
- `interface ResidentFollowUp`

---

## packages/api-client

Adicionar em `packages/api-client/src/modules/residents.ts`:

```ts
getFollowUps: (id: string) =>
  http.get<ResidentFollowUp[]>(`/residents/${id}/follow-ups`).then(r => r.data),

createFollowUp: (id: string, data: CreateFollowUpInput) =>
  http.post<ResidentFollowUp>(`/residents/${id}/follow-ups`, data).then(r => r.data),
```

---

## adm.fonte

| Arquivo                                               | Ação                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `features/residents/hooks/useResidentFollowUps.ts`    | novo — `useResidentFollowUps(id)`, `useCreateFollowUp(id)`                       |
| `features/residents/components/tabs/TrackingTab.tsx`  | novo — timeline + botão "Registrar evento"                                       |
| `features/residents/components/TrackingEventItem.tsx` | novo — ícone por tipo, data, descrição, badge accessLevel, nome criador          |
| `features/residents/components/AddFollowUpDialog.tsx` | novo — Dialog: date, type (Select), description (Textarea), accessLevel (Select) |
| `features/residents/pages/ResidentDetailPage.tsx`     | substituir placeholder `timeline` por `<TrackingTab residentId={id!} />`         |
| `lib/queryKeys.ts`                                    | adicionar `followUps: (id) => [...residents.detail(id), 'follow-ups']`           |
| `features/residents/constants.ts`                     | labels + ícones para `FollowUpType` e `FollowUpAccessLevel`                      |

---

## ops.fonte

| Arquivo                                                 | Ação                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `features/residents/hooks/useResidentFollowUps.ts`      | novo                                                                                   |
| `features/residents/components/ResidentTrackingTab.tsx` | novo — timeline + botão "Registrar evento"                                             |
| `features/residents/components/TrackingEventItem.tsx`   | novo                                                                                   |
| `features/residents/components/AddFollowUpModal.tsx`    | novo — Modal nativo: date, type, description, accessLevel                              |
| `features/residents/pages/ResidentDetailPage.tsx`       | substituir placeholder `Acompanhamento` por `<ResidentTrackingTab residentId={id!} />` |
| `lib/queryKeys.ts`                                      | adicionar `followUps(id)`                                                              |
| `features/residents/constants.ts`                       | labels para `FollowUpType`                                                             |

> **Nota**: SERVANT só vê e só pode criar eventos com `accessLevel = ALL`. O campo accessLevel não aparece no formulário do ops.fonte.

---

## Ordem de execução

1. `packages/types` — enums + interface
2. Backend — migration + entidade + módulo + serviço + endpoints
3. `packages/api-client` — métodos
4. `adm.fonte` — hooks + componentes + TrackingTab
5. `ops.fonte` — hooks + componentes + ResidentTrackingTab

---

## Verificação end-to-end

1. Criar residente → aba Acompanhamento exibe evento ADMISSION automaticamente
2. Adicionar familiar → evento RELATIVE_ADDED aparece
3. Mudar status para Alta → evento DISCHARGE aparece
4. Registrar evento MONTHLY_CONTRIBUTION (accessLevel ADMINISTRATION) → visível para ADMIN
5. Registrar evento com accessLevel ADMINISTRATION → aparece para ADMIN, **não** para SERVANT nem COORDINATOR
6. `pnpm test:api` passa após mudanças no backend
