# REVIEW_PLAN.md

Frontend review plan for all three apps. Ordered by priority.
No code was changed to produce this file.

---

## Metodologia

Cada domínio foi avaliado contra as regras de `CLAUDE.md`:

- **P1** — Componente/page > 150 linhas
- **P2** — `useForm` / `useQuery` / `useMutation` importado diretamente em `pages/`
- **P3** — `useMutation` / `useQuery` raw em `components/` (fora de `hooks/`)
- **P4** — Ausência de `components/` quando page > 150 linhas
- **P5** — Funções-componente inline no mesmo arquivo da page
- **P6** — Prop drilling que deveria ser resolvido pelo dialog via hook
- **P7** — Duplicação entre apps (ex: `MessageInput` igual em ops e app)

Campos de dependência por domínio:

- **`depends_on`** — domínios cujas APIs públicas devem estar estáveis antes deste PR ser mergeado
- **`blocks`** — domínios que importam deste; cuidado ao renomear exports
- **`safe_to_parallelize`** — pode rodar em paralelo com outros PRs sem risco de conflito

> **Nota sobre `@fonte/types` e `@fonte/api-client`:** usados em todos os domínios como type-imports.
> Não afetam ordenação de review — nenhum domínio altera os pacotes durante esse ciclo.

---

## Mapa de dependências cruzadas

```
ADM.FONTE (imports entre features/)
─────────────────────────────────────────────────────────
dashboard ──────────────────────────────→ houses
                                          ↑ ↓  (bidirecional)
residents ←──────────────────────────────
  ↑ importa useHouses (houses)
  ↑ importa useDocumentTemplates (settings)
  └─ lib/masks.ts ←────────────────────── staff

houses ────────────────────────────────→ staff (useStaff)
settings ──────────────────────────────→ staff (useStaff + permissions)
staff ─────────────────────────────────→ support-groups (useSupportGroups)
support-groups ────────────────────────→ staff (useStaff)
                                          ↑ ↓  (bidirecional)

OPS.FONTE (imports entre features/)
─────────────────────────────────────────────────────────
support-groups ────────────────────────→ residents (useAllResidents)
[todos os demais domínios: sem imports cruzados]

APP.FONTE (imports entre features/)
─────────────────────────────────────────────────────────
messages ──────────────────────────────→ home (useRelativeMe)
profile  ──────────────────────────────→ home (useRelativeMe)
```

**Bidirecionais que exigem coordenação de PR:**
- `adm/houses` ↔ `adm/residents` — se `useResidents.ts` for dividido, `houses/tabs/ResidentsTab.tsx` quebra
- `adm/staff` ↔ `adm/support-groups` — baixo risco (PRs não compartilham arquivos), mas exports públicos devem ser preservados

**Apps são completamente independentes entre si** — qualquer domínio de apps diferentes sempre é seguro paralelizar.

---

## ALTA PRIORIDADE

### 1. `adm.fonte` — residents
**Branch:** `review/adm-residents`
**Sessão estimada:** 1 (domínio complexo, prioridade máxima)

**Arquivos:**
```
apps/adm.fonte/src/features/residents/
  pages/ResidentDetailPage.tsx   ← 693 linhas ← CRÍTICO
  pages/EditResidentPage.tsx     ← 90 linhas, useForm direto na page (P2)
  pages/NewResidentPage.tsx      ← 74 linhas, useForm direto na page (P2)
  pages/ResidentsPage.tsx        ← 178 linhas (P1)
  components/GenerateRelativeAccessDialog.tsx  ← 131 linhas, useForm (P2)
  components/GenerateResidentAccessDialog.tsx  ← 131 linhas, useForm (P2)
  components/ResetRelativePasswordDialog.tsx   ← 99 linhas
  components/ResetResidentPasswordDialog.tsx   ← 99 linhas
  components/ResidentFormSections.tsx          ← 147 linhas (P1)
  hooks/useResidents.ts          ← 208 linhas (maior hook do projeto)
  lib/masks.ts / lib/residentSchema.ts
  constants.ts
```

**Problemas detectados:**
- `ResidentDetailPage.tsx` 693 linhas: contém 7 `useState`, 1 `useForm`, JSX de 5+ seções distintas (info pessoal, familiares, documentos, anexos, acesso) e 6 sub-componentes definidos no mesmo arquivo (`AttachmentsTab`, `GenerateDocumentMenu`, `AttachmentUploadButton`, `AttachmentRow`, `DocumentCard`, helpers) — violações P1, P2, P4, P5
- `EditResidentPage.tsx` e `NewResidentPage.tsx`: `useForm` diretamente na page (P2) — deveria estar em hook ou componente de formulário
- `GenerateRelativeAccessDialog.tsx` / `GenerateResidentAccessDialog.tsx`: `useForm` em componentes — aceitável como dialog autossuficiente, mas 131 linhas cada sugere extração de campos
- `ResidentFormSections.tsx` 147 linhas: próximo do limite, recebe `register` + `errors` via prop (prop drilling leve, P6)
- `useResidents.ts` 208 linhas: monolítico, mistura queries de resident, relatives, documents e attachments — candidato a split em arquivos por responsabilidade

**Ações esperadas:**
- Extrair 6 sub-componentes de `ResidentDetailPage` para `components/`
- Quebrar a page em seções: `ResidentInfoSection`, `ResidentRelativesSection`, `ResidentDocumentsSection`, `ResidentAttachmentsSection`
- Mover `useForm` de `EditResidentPage`/`NewResidentPage` para componentes de formulário (`ResidentForm`)
- Dividir `useResidents.ts` em `useResidents.ts` + `useResidentRelatives.ts` + `useResidentDocuments.ts`

**Dependências:**
- `depends_on`: adm/houses (`useHouses` em EditResidentPage/NewResidentPage), adm/settings (`useDocumentTemplates` em ResidentDetailPage)
- `blocks`: adm/houses (`useResidentById` + constants importados por `ResidentsTab.tsx`); adm/staff (`lib/masks.ts` importado por EditStaffPage/NewStaffPage)
- `safe_to_parallelize`: **false com adm/houses** — se `useResidents.ts` for dividido, o import de `useResidentById` em `houses/tabs/ResidentsTab.tsx` quebra; incluir esse arquivo no mesmo PR. **true com adm/settings, adm/auth** — sem conflito de arquivos.

---

### 2. `adm.fonte` — settings
**Branch:** `review/adm-settings`
**Sessão estimada:** 1

**Arquivos:**
```
apps/adm.fonte/src/features/settings/
  pages/DocumentTemplatesTab.tsx    ← 366 linhas ← CRÍTICO
  pages/ChildAppSettingsPage.tsx    ← 94 linhas, useForm direto (P2)
  pages/PermissionsPage.tsx         ← 97 linhas
  pages/SettingsPage.tsx            ← 49 linhas
  pages/DocumentTemplatesPage.tsx   ← 18 linhas
  hooks/useAppSettings.ts
  hooks/useDocumentTemplates.ts
```

**Problemas detectados:**
- `DocumentTemplatesTab.tsx` 366 linhas: `useForm` + múltiplas seções de UI (lista, editor, preview) — violações P1, P2, P4, P5
- Ausência de `components/` — todo código de UI está em `pages/` (P4)
- `ChildAppSettingsPage.tsx`: `useForm` direto (P2)
- `DocumentTemplatesPage.tsx` apenas 18 linhas: provavelmente apenas importa `DocumentTemplatesTab` — estrutura questionável

**Ações esperadas:**
- Criar `components/` e extrair: `TemplateList`, `TemplateEditor`, `TemplatePreview` de `DocumentTemplatesTab`
- Mover `useForm` de `ChildAppSettingsPage` para componente de formulário

**Dependências:**
- `depends_on`: adm/staff (`useStaff` + hooks de permissão usados em `PermissionsPage`)
- `blocks`: adm/residents (`useDocumentTemplates` usado em `ResidentDetailPage`)
- `safe_to_parallelize`: **true com adm/auth, adm/dashboard** — refatoração interna de `DocumentTemplatesTab` não altera API pública de `useDocumentTemplates`; adm/residents pode rodar em paralelo desde que `useDocumentTemplates` permaneça no mesmo caminho

---

### 3. `ops.fonte` — ministries
**Branch:** `review/ops-ministries`
**Sessão estimada:** 1

**Arquivos:**
```
apps/ops.fonte/features/ministries/
  pages/MinistryDetailPage.tsx   ← 467 linhas ← CRÍTICO
  pages/MinistriesPage.tsx       ← 303 linhas (P1)
  hooks/useMinistries.ts         ← 159 linhas
```

**Problemas detectados:**
- `MinistryDetailPage.tsx` 467 linhas: sem `components/` (P4), lógica de 2 tabs (Visão Geral + Tarefas) + modais inline, `useState` para múltiplos modais, helpers internos — violações P1, P4, P5
- `MinistriesPage.tsx` 303 linhas: sem componentes extraídos; renderiza `FlatList` com item inline complexo (P1, regra "NUNCA renderizar FlatList com item inline")
- Zero arquivos em `components/` — pasta inexistente

**Ações esperadas:**
- Criar `components/`: `MinistryCard`, `MinistryTaskItem`, `MinistryMembersSection`, `TasksTab`, `OverviewTab`
- Quebrar `MinistryDetailPage` em tabs separadas

**Dependências:**
- `depends_on`: nenhum
- `blocks`: nenhum
- `safe_to_parallelize`: **true** — sem imports cruzados; isolado dentro de ops.fonte

---

### 4. `ops.fonte` — wishlist
**Branch:** `review/ops-wishlist`
**Sessão estimada:** 0.5 (pode combinar com ops/support-groups)

**Arquivos:**
```
apps/ops.fonte/features/wishlist/
  pages/WishlistPage.tsx    ← 348 linhas ← CRÍTICO
  hooks/useWishlist.ts      ← 60 linhas
```

**Problemas detectados:**
- `WishlistPage.tsx` 348 linhas: contém 3 funções-componente internas (`ResidentWishlistPage`, `StaffWishlistPage` + dispatcher) — deveriam ser arquivos separados em `components/` (P1, P4, P5)
- Sem `components/` (P4)
- `StaffWishlistPage` renderiza `FlatList` com item inline — item não extraído

**Ações esperadas:**
- Criar `components/WishlistItem.tsx`, `components/ResidentWishlist.tsx`, `components/StaffWishlist.tsx`
- `WishlistPage` vira dispatcher puro (< 30 linhas)

**Dependências:**
- `depends_on`: nenhum
- `blocks`: nenhum
- `safe_to_parallelize`: **true** — totalmente isolado; sem imports cruzados em ops.fonte

---

### 5. `ops.fonte` — messages
**Branch:** `review/ops-messages`
**Sessão estimada:** 1

**Arquivos:**
```
apps/ops.fonte/features/messages/
  components/MessageInput.tsx          ← 272 linhas (P1)
  components/AudioPlayer.tsx           ← 91 linhas
  pages/MessagesPage.tsx               ← 214 linhas (P1)
  pages/ConversationPage.tsx           ← 157 linhas (P1)
  pages/ModerationPage.tsx             ← 162 linhas (P1)
  pages/DirectConversationsPage.tsx    ← 79 linhas
  pages/DirectThreadPage.tsx           ← 142 linhas
  hooks/useMessages.ts                 ← 134 linhas
```

**Problemas detectados:**
- `MessageInput.tsx` 272 linhas: componente único com lógica de gravação de áudio, envio de texto e gerenciamento de permissões — 3 responsabilidades (P1)
- `MessagesPage.tsx` 214 linhas: rota hub que renderiza subitens inline sem extração (P1)
- `ConversationPage.tsx` + `ModerationPage.tsx` > 150 linhas (P1)
- Possível duplicação com `app.fonte/messages/MessageInput.tsx` (348 linhas) — verificar se são idênticos

**Ações esperadas:**
- Extrair `AudioRecorder`, `TextComposer` de `MessageInput`
- Quebrar `MessagesPage` em componentes de item/seção

**Dependências:**
- `depends_on`: nenhum (dentro de ops.fonte)
- `blocks`: nenhum
- `safe_to_parallelize`: **true dentro de ops.fonte**; **coordenar com app/messages (P7)** — se `MessageInput` for extraído para `packages/`, ops e app devem ir no mesmo PR para não quebrar imports

---

### 6. `ops.fonte` — support-groups
**Branch:** `review/ops-support-groups`
**Sessão estimada:** 1 (combina com ops/wishlist = 1.5 sessões)

**Arquivos:**
```
apps/ops.fonte/features/support-groups/
  pages/SupportGroupsPage.tsx    ← 283 linhas (P1)
  pages/MeetingDetailPage.tsx    ← 248 linhas (P1)
  hooks/useSupportGroups.ts      ← 59 linhas
```

**Problemas detectados:**
- `SupportGroupsPage.tsx` 283 linhas: sem `components/`, `FlatList` com item inline (P1, P4, P5)
- `MeetingDetailPage.tsx` 248 linhas: sem `components/` (P1, P4) — importa `useAllResidents` de `ops/residents`
- Ausência total de pasta `components/`

**Ações esperadas:**
- Criar `components/`: `SupportGroupCard`, `MeetingHeader`, `FamilyCheckinList`, `CheckinItem`

**Dependências:**
- `depends_on`: ops/residents (`useAllResidents` importado por `MeetingDetailPage`)
- `blocks`: nenhum
- `safe_to_parallelize`: **true** — `useAllResidents` é hook read-only simples; refatoração interna de ops/residents (`ResidentDetailPage`, `ChangeMinistryModal`) não altera sua assinatura; pode rodar em paralelo desde que `useAllResidents` seja preservado

---

### 7. `ops.fonte` — profile
**Branch:** `review/ops-profile`
**Sessão estimada:** 0.5

**Arquivos:**
```
apps/ops.fonte/features/profile/
  pages/ProfilePage.tsx    ← 328 linhas (P1)
  hooks/useProfile.ts      ← 42 linhas
```

**Problemas detectados:**
- `ProfilePage.tsx` 328 linhas: 2 `useForm` diretos (profileForm + passwordForm) (P1, P2)
- Sem `components/` (P4)
- Idêntica em estrutura a `app.fonte/features/profile/ProfilePage.tsx` (308 linhas) — mesma violação duplicada em dois apps

**Ações esperadas:**
- Extrair `ProfileForm`, `ChangePasswordForm` como componentes
- Avaliar se `ProfilePage` pode compartilhar componentes entre ops e app

**Dependências:**
- `depends_on`: nenhum
- `blocks`: nenhum
- `safe_to_parallelize`: **true**; **coordenar com app/profile (P7)** — estrutura idêntica; se extração for para `packages/`, incluir app/profile no mesmo PR

---

### 8. `app.fonte` — messages
**Branch:** `review/app-messages`
**Sessão estimada:** 1

**Arquivos:**
```
apps/app.fonte/features/messages/
  components/MessageInput.tsx          ← 348 linhas ← CRÍTICO
  components/MessageBubble.tsx         ← 119 linhas
  components/AudioPlayer.tsx           ← 91 linhas
  pages/ConversationListPage.tsx       ← 116 linhas
  pages/MessagesPage.tsx               ← 53 linhas
  pages/StaffThreadPage.tsx            ← 56 linhas
  hooks/useMessages.ts                 ← 93 linhas
```

**Problemas detectados:**
- `MessageInput.tsx` 348 linhas: pior violação de componente no codebase — lógica de áudio, permissões, upload e composição numa única classe (P1)
- `MessageBubble.tsx` 119 linhas: borderline (próximo do limite)
- Possível duplicação com `ops.fonte/features/messages/MessageInput.tsx` — verificar no início da sessão

**Ações esperadas:**
- Extrair `AudioRecordButton`, `AttachmentPicker`, `SendButton` de `MessageInput`
- Se ops/app compartilham lógica: mover para `packages/` ou criar componente compartilhado

**Dependências:**
- `depends_on`: app/home (`useRelativeMe` importado por `ConversationListPage`)
- `blocks`: nenhum
- `safe_to_parallelize`: **true** — app/home é LOW priority e não será refatorado; API de `useRelativeMe` (11 linhas) permanece estável; **coordenar com ops/messages** se MessageInput for extraído para `packages/`

---

### 9. `app.fonte` — profile
**Branch:** `review/app-profile`
**Sessão estimada:** 0.5

**Arquivos:**
```
apps/app.fonte/features/profile/
  pages/ProfilePage.tsx    ← 308 linhas (P1)
  hooks/useProfile.ts      ← 35 linhas
```

**Problemas detectados:**
- `ProfilePage.tsx` 308 linhas: 2 `useForm` diretos (P1, P2)
- Sem `components/` (P4)
- Espelho quase idêntico de `ops.fonte/features/profile/ProfilePage.tsx`

**Ações esperadas:**
- Mesmas de ops/profile
- Priorizar revisão conjunta com `review/ops-profile`

**Dependências:**
- `depends_on`: app/home (`useRelativeMe` importado por `ProfilePage`)
- `blocks`: nenhum
- `safe_to_parallelize`: **true** — app/home estável; **coordenar com ops/profile** se componentes forem extraídos para `packages/`

---

## MÉDIA PRIORIDADE

### 10. `adm.fonte` — staff
**Branch:** `review/adm-staff`
**Sessão estimada:** 0.5

**Arquivos:**
```
apps/adm.fonte/src/features/staff/
  pages/NewStaffPage.tsx     ← 199 linhas, useForm direto (P1, P2)
  pages/EditStaffPage.tsx    ← 192 linhas, useForm direto (P1, P2)
  pages/StaffPage.tsx        ← 129 linhas
  components/ResetPasswordDialog.tsx  ← 99 linhas
  hooks/useStaff.ts          ← 97 linhas
```

**Problemas detectados:**
- `NewStaffPage` e `EditStaffPage` ambos > 150 linhas com `useForm` direto (P1, P2)
- Formulários de criação e edição provavelmente duplicam campos — candidato a `StaffForm` compartilhado

**Ações esperadas:**
- Extrair `StaffForm` para `components/` com campos de nome, role, house
- Pages ficam com < 50 linhas cada

**Dependências:**
- `depends_on`: adm/residents (`lib/masks.ts`), adm/houses (`useHouses`), adm/support-groups (`useSupportGroups`)
- `blocks`: adm/houses (`useStaff` em HouseDialog + OverviewTab), adm/settings (`useStaff` + permissões em PermissionsPage), adm/support-groups (`useStaff` em SupportGroupDialog)
- `safe_to_parallelize`: **false com adm/support-groups** — bidirecional; na prática os PRs não tocam arquivos do outro, mas renomear exports quebraria os dois lados; **true com adm/auth, adm/dashboard** — sem conflito de arquivos

---

### 11. `adm.fonte` — houses
**Branch:** `review/adm-houses`
**Sessão estimada:** 1 (maior domínio do adm)

**Arquivos:**
```
apps/adm.fonte/src/features/houses/
  components/HouseDialog.tsx                       ← 73 linhas, useForm (mas dialog — OK)
  components/HouseFormFields.tsx                   ← 70 linhas (recebe register/errors via prop — P6 leve)
  components/LeaderAutocomplete.tsx                ← 97 linhas
  components/tabs/OverviewTab.tsx                  ← 187 linhas, useForm direto (P1, P2)
  components/tabs/AddMinistryDialog.tsx            ← 145 linhas (no limite)
  components/tabs/MinistriesTab.tsx                ← 82 linhas
  components/tabs/ResidentsTab.tsx                 ← 124 linhas  ← importa useResidentById de adm/residents
  components/tabs/RulesTab.tsx                     ← 58 linhas
  components/tabs/StaffTab.tsx                     ← 38 linhas
  components/tabs/StoreroomTab.tsx                 ← 73 linhas
  components/tabs/AddRuleDialog.tsx                ← 57 linhas, useForm (dialog — OK)
  components/tabs/EditMinistryLeaderDialog.tsx     ← 64 linhas
  components/tabs/RemoveMinistryDialog.tsx         ← 38 linhas
  components/tabs/RemoveRuleDialog.tsx             ← 38 linhas
  pages/HouseDetailPage.tsx                        ← 75 linhas
  pages/HousesPage.tsx                             ← 147 linhas (no limite)
  hooks/useHouses.ts / useHouseMinistries.ts / useHouseRules.ts
  constants.ts
```

**Problemas detectados:**
- `OverviewTab.tsx` 187 linhas com `useForm` direto — componente, não dialog (P1, P2)
- `AddMinistryDialog.tsx` 145 linhas: no limite, mas OK se autossuficiente
- `HousesPage.tsx` 147 linhas: no limite
- Estrutura de tabs bem organizada — menor prioridade dentro deste domínio
- `HouseFormFields` recebe `register` e `errors` via prop — leve P6

**Ações esperadas:**
- `OverviewTab`: extrair seção de formulário inline para `HouseEditForm`
- `HousesPage`: verificar se pode quebrar `HouseCard` inline

**Dependências:**
- `depends_on`: adm/staff (`useStaff` em HouseDialog + OverviewTab), adm/residents (`useResidentById` + constants em ResidentsTab)
- `blocks`: adm/residents (`useHouses` em EditResidentPage/NewResidentPage), adm/staff (`useHouses`), adm/dashboard (`useHouses`)
- `safe_to_parallelize`: **false com adm/residents** — `ResidentsTab.tsx` importa `useResidentById` de adm/residents; se adm/residents dividir `useResidents.ts`, o import em `ResidentsTab` quebra — coordenar no mesmo PR ou fazer residents primeiro; **true com adm/auth, adm/settings**

---

### 12. `ops.fonte` — storeroom
**Branch:** `review/ops-storeroom`
**Sessão estimada:** 0.5 (já bem decomposto)

**Arquivos:**
```
apps/ops.fonte/features/storeroom/
  pages/MovementPage.tsx                 ← 184 linhas, useForm direto (P1, P2)
  pages/StoreroomPage.tsx                ← 90 linhas
  components/ItemDetailsModal.tsx        ← 213 linhas (P1)
  components/ItemSearchInput.tsx         ← 120 linhas (no limite)
  components/DatePickerModal.tsx         ← 138 linhas
  components/MovementChart.tsx           ← 72 linhas
  components/NewItemForm.tsx             ← 64 linhas
  components/StoreroomItemCard.tsx       ← 52 linhas
  components/SuccessBanner.tsx           ← 83 linhas
  + 6 componentes menores
  hooks/useStoreroom.ts                  ← 56 linhas
  utils.ts
```

**Problemas detectados:**
- `MovementPage.tsx` 184 linhas com `useForm` direto (P1, P2)
- `ItemDetailsModal.tsx` 213 linhas (P1) — candidato a split
- Domínio já bem decomposto (13 arquivos) — menor impacto relativo

**Ações esperadas:**
- Extrair lógica de `useForm` de `MovementPage` para hook ou componente `MovementForm`
- Quebrar `ItemDetailsModal` em seções (tabs ou sub-componentes)

**Dependências:**
- `depends_on`: nenhum
- `blocks`: nenhum
- `safe_to_parallelize`: **true** — totalmente isolado dentro de ops.fonte

---

### 13. `ops.fonte` — residents
**Branch:** `review/ops-residents`
**Sessão estimada:** 0.5

**Arquivos:**
```
apps/ops.fonte/features/residents/
  pages/ResidentDetailPage.tsx           ← 330 linhas (P1)
  pages/ResidentsPage.tsx                ← 56 linhas
  components/ChangeMinistryModal.tsx     ← 172 linhas, useMutation raw (P1, P3)
  components/ResetResidentPasswordModal.tsx  ← 74 linhas
  components/ResidentListItem.tsx        ← 45 linhas
  components/ResidentSearchBar.tsx       ← 29 linhas
  hooks/useResidents.ts / useHouseMinistries.ts
```

**Problemas detectados:**
- `ResidentDetailPage.tsx` 330 linhas: seções de info, ministério, incidentes, senha — sem extração (P1, P4)
- `ChangeMinistryModal.tsx` 172 linhas: `useMutation` + `useQueryClient` raw (P1, P3) — deveria delegar para hook em `hooks/`

**Ações esperadas:**
- Mover mutation de `ChangeMinistryModal` para `useResidents.ts` (hook `useChangeMinistry`)
- Extrair seções de `ResidentDetailPage` para componentes: `ResidentMinistrySection`, `ResidentIncidentsSection`

**Dependências:**
- `depends_on`: nenhum
- `blocks`: ops/support-groups (`useAllResidents` importado por `MeetingDetailPage`)
- `safe_to_parallelize`: **true** — refatoração de `ResidentDetailPage` e `ChangeMinistryModal` não altera assinatura de `useAllResidents`; ops/support-groups pode rodar em paralelo

---

### 14. `ops.fonte` — incidents
**Branch:** `review/ops-incidents`
**Sessão estimada:** 0.5

**Arquivos:**
```
apps/ops.fonte/features/incidents/
  pages/NewIncidentPage.tsx    ← 170 linhas, useForm direto (P1, P2)
  pages/IncidentsPage.tsx      ← 59 linhas
  components/IncidentCard.tsx  ← 49 linhas
  components/ResidentPicker.tsx  ← 36 linhas
  components/SeveritySelector.tsx  ← 40 linhas
  hooks/useIncidents.ts        ← 39 linhas
```

**Problemas detectados:**
- `NewIncidentPage.tsx` 170 linhas com `useForm` direto (P1, P2)

**Ações esperadas:**
- Extrair `IncidentForm` para `components/`
- Page fica < 50 linhas

**Dependências:**
- `depends_on`: nenhum
- `blocks`: nenhum
- `safe_to_parallelize`: **true** — totalmente isolado

---

### 15. `adm.fonte` — auth
**Branch:** `review/adm-auth` (pode combinar com adm/support-groups)
**Sessão estimada:** 0.5

**Arquivos:**
```
apps/adm.fonte/src/features/auth/
  pages/ChangePasswordPage.tsx    ← 114 linhas, useForm direto (P2)
  pages/LoginPage.tsx             ← 85 linhas, useForm direto (P2)
  hooks/useAuth.ts                ← 8 linhas
```

**Problemas detectados:**
- Ambas as pages usam `useForm` diretamente (P2) — violação da regra "pages não fazem fetch/form"
- Domínio pequeno, impacto baixo

**Ações esperadas:**
- Extrair `LoginForm`, `ChangePasswordForm` para `components/`

**Dependências:**
- `depends_on`: nenhum
- `blocks`: nenhum
- `safe_to_parallelize`: **true** — sem imports cruzados; pode rodar em paralelo com qualquer domínio de qualquer app

---

### 16. `adm.fonte` — support-groups
**Branch:** `review/adm-support-groups`
**Sessão estimada:** 0.5

**Arquivos:**
```
apps/adm.fonte/src/features/support-groups/
  pages/SupportGroupsPage.tsx              ← 148 linhas (no limite)
  components/SupportGroupDialog.tsx        ← 137 linhas, useForm (dialog — OK)
  components/MeetingFamiliesModal.tsx      ← 82 linhas
  hooks/useSupportGroups.ts               ← 76 linhas
```

**Problemas detectados:**
- `SupportGroupsPage.tsx` 148 linhas: no limite, renderiza lista inline
- Estrutura relativamente saudável — menor prioridade

**Ações esperadas:**
- Extrair `SupportGroupRow` para `components/` se lista tiver lógica de item

**Dependências:**
- `depends_on`: adm/staff (`useStaff` em SupportGroupDialog)
- `blocks`: adm/staff (`useSupportGroups` importado por EditStaffPage/NewStaffPage)
- `safe_to_parallelize`: **false com adm/staff** — bidirecional; na prática os PRs não compartilham arquivos, mas exports públicos (`useSupportGroups`, `useStaff`) devem ser preservados; processar junto ou sequencialmente

---

## BAIXA PRIORIDADE

### 17. `ops.fonte` — dashboard
**Branch:** incluir em `review/ops-misc`
**Sessão estimada:** 0.25

**Arquivos:**
```
apps/ops.fonte/features/dashboard/
  components/QuickActions.tsx    ← 63 linhas
  components/StatCards.tsx       ← 21 linhas
  components/WelcomeHeader.tsx   ← 44 linhas
  pages/DashboardPage.tsx        ← 48 linhas
```
**Status:** Bem estruturado. Sem violações visíveis.

**Dependências:**
- `depends_on`: nenhum
- `blocks`: nenhum
- `safe_to_parallelize`: **true**

---

### 18. `adm.fonte` — dashboard
**Branch:** incluir em `review/adm-misc`
**Sessão estimada:** 0.25

**Arquivos:**
```
apps/adm.fonte/src/features/dashboard/
  pages/DashboardPage.tsx    ← 76 linhas
```
**Status:** Provavelmente saudável. Apenas verificar ausência de fetch direto.

**Dependências:**
- `depends_on`: adm/houses (`useHouses` importado)
- `blocks`: nenhum
- `safe_to_parallelize`: **true** — não modifica arquivos de houses; só consome hook estável

---

### 19. `app.fonte` — checkin
**Branch:** incluir em `review/app-misc`

**Arquivos:**
```
apps/app.fonte/features/checkin/
  pages/CheckinPage.tsx    ← 116 linhas
  hooks/useCheckin.ts      ← 8 linhas
```
**Suspeita:** Page pode ter lógica de formulário inline. Verificar no início da sessão.

**Dependências:**
- `depends_on`: nenhum
- `blocks`: nenhum
- `safe_to_parallelize`: **true**

---

### 20. `app.fonte` — home
**Branch:** incluir em `review/app-misc`

**Arquivos:**
```
apps/app.fonte/features/home/
  pages/HomePage.tsx        ← 91 linhas
  hooks/useRelativeMe.ts    ← 11 linhas
```
**Status:** Pequeno. Verificar estrutura.

**Dependências:**
- `depends_on`: nenhum
- `blocks`: app/messages (`useRelativeMe`), app/profile (`useRelativeMe`)
- `safe_to_parallelize`: **true** — domínio trivial; não será refatorado; export `useRelativeMe` permanece estável

---

### 21. `app.fonte` — wishlist
**Branch:** incluir em `review/app-misc`

**Arquivos:**
```
apps/app.fonte/features/wishlist/
  pages/WishlistPage.tsx          ← 41 linhas
  components/WishlistItemCard.tsx ← 23 linhas
  hooks/useWishlist.ts            ← 11 linhas
```
**Status:** Saudável. Provavelmente sem problemas.

**Dependências:**
- `depends_on`: nenhum
- `blocks`: nenhum
- `safe_to_parallelize`: **true**

---

## Grupos de execução paralela

Apps diferentes são sempre independentes entre si — qualquer domínio de apps distintos pode rodar em paralelo sem risco de conflito.

### Rodada 1 — Imediato (zero dependências prévias)

Todos esses domínios podem começar sem esperar nada. São os mais seguros para paralelizar:

| Dev / Slot | Domínio | App | Sessão |
|---|---|---|---|
| A | adm/auth | adm | S15 |
| B | ops/ministries | ops | S3 |
| C | app/messages + app/profile | app | S8+S9 |
| D | ops/wishlist + ops/support-groups | ops | S4 |
| E | ops/messages | ops | S5 |
| F | ops/storeroom + ops/incidents | ops | S12+S14 |
| G | ops/profile + ops/residents + ops/dashboard | ops | S7+S13+S17 |

> **Nota A+B+C:** podem iniciar imediatamente, são de apps diferentes — zero risco de conflito de merge.
> **Nota D:** ops/support-groups pode rodar junto com ops/wishlist; depende de ops/residents API estar estável, mas ops/residents pode rodar em paralelo na mesma rodada (useAllResidents não será alterado).
> **Nota C (ops + app messages):** se a decisão for extrair `MessageInput` para `packages/`, slots E e C devem ir no mesmo PR — coordenar antes de abrir branches separadas.

---

### Rodada 2 — Após Rodada 1 (adm complexo)

Requer que as APIs públicas dos domínios usados estejam estáveis (confirmado ao final da Rodada 1):

| Dev / Slot | Domínio | App | Sessão | Pré-requisito |
|---|---|---|---|---|
| A | adm/residents **+** atualizar `houses/tabs/ResidentsTab.tsx` | adm | S1 | — |
| B | adm/settings | adm | S2 | adm/staff API estável (não alterada na Rodada 1; OK) |
| C | — (app já concluído na Rodada 1) | — | — | — |

> **Atenção:** adm/residents e adm/houses são bidirecionais. Se `useResidents.ts` for dividido, o PR de adm/residents **deve incluir** a atualização de `apps/adm.fonte/src/features/houses/components/tabs/ResidentsTab.tsx`. Não abrir PR de adm/houses separado enquanto esse split estiver pendente.

---

### Rodada 3 — adm restante

| Dev / Slot | Domínio | App | Sessão | Pré-requisito |
|---|---|---|---|---|
| A | adm/houses (OverviewTab + HousesPage) | adm | S11 | adm/residents finalizado (ResidentsTab atualizado) |
| B | adm/staff **+** adm/support-groups juntos | adm | S10+S16 | coordenar bidirecional — mesmo PR ou sequencial |
| C | adm/dashboard (trivial) | adm | S18 | adm/houses API estável |

> **Atenção:** adm/staff e adm/support-groups são bidirecionais. Podem ir no mesmo PR ou em sequência imediata (staff → support-groups). Nunca em PRs simultâneos abertos ao mesmo tempo.

---

### Resumo visual de dependências para execução

```
Rodada 1 (paralelo total):
  adm/auth  ──────────────────────────────────────────→ done
  ops/* (todos exceto support-groups) ────────────────→ done
  ops/support-groups ─────────────────────────────────→ done (useAllResidents preservado)
  app/* (todos) ──────────────────────────────────────→ done

Rodada 2 (adm alta prioridade):
  adm/residents (+ResidentsTab update) ───────────────→ done
  adm/settings ───────────────────────────────────────→ done

Rodada 3 (adm médio + final):
  adm/houses ─────────(após residents)────────────────→ done
  adm/staff + adm/support-groups ─────────────────────→ done
  adm/dashboard ──────────────────────────────────────→ done
```

**Mínimo de rodadas para um único dev:** 3 (sequencial: Rodada 1 ops+app → Rodada 2 adm alta → Rodada 3 adm média)
**Mínimo de rodadas para time de 3+ devs:** 2 (Rodada 1 ops+app+adm/auth em paralelo → Rodada 2+3 adm coordenado)

---

## Resumo por sessão

| Sessão | Domínios | Apps | Linhas totais | Esforço |
|--------|----------|------|---------------|---------|
| 1 | residents | adm | ~1,920 | Alto — página de 693 linhas |
| 2 | settings | adm | ~689 | Alto — tab de 366 linhas |
| 3 | ministries | ops | ~929 | Alto — sem components/ |
| 4 | wishlist + support-groups | ops | ~998 | Médio-alto — 3 pages sem components/ |
| 5 | messages | ops | ~1,119 | Alto — MessageInput de 272 linhas |
| 6 | messages + profile | app | ~1,169 | Alto — MessageInput de 348 linhas + ProfilePage de 308 |
| 7 | profile + residents | ops | ~1,103 | Médio — 2 pages entre 328-330 linhas |
| 8 | staff + houses + auth | adm | ~2,273 | Médio — domínio maior, mas menos crítico |
| 9 | storeroom + incidents + residents | ops | ~2,271 | Médio — já bem decomposto |
| 10 | support-groups + misc (todos low) | adm + app | ~1,000 | Baixo — verificação final |

**Total estimado: 10 sessões**

---

## Problemas transversais (verificar em todas as sessões)

1. **`useForm` em pages** — violação recorrente em adm.fonte (staff, auth, residents, settings) e ops.fonte (profile, storeroom, incidents). Padrão: mover para componente de formulário em `components/`.

2. **`MessageInput` duplicado** — `ops.fonte` (272 linhas) e `app.fonte` (348 linhas) têm componentes similares. Antes das sessões 5/6: comparar conteúdo e avaliar extração para `packages/`. **Se extrair: S5 e S6 devem ser o mesmo PR.**

3. **`ProfilePage` duplicada** — `ops.fonte` (328 linhas) e `app.fonte` (308 linhas) quase idênticas. **Se extrair: S7 (ops/profile) e S6 (app/profile) devem ser coordenados.**

4. **Ausência de `components/`** — ops.fonte: `ministries/`, `wishlist/`, `support-groups/`, `profile/` não têm pasta. Criar antes de qualquer extração.

5. **`FlatList` com item inline** — ops.fonte: `MinistriesPage`, `WishlistPage`, `SupportGroupsPage`. Extrair item como componente nomeado.

6. **`useMutation` raw em `components/`** — `ops.fonte/residents/components/ChangeMinistryModal.tsx` usa `useMutation` diretamente. Mover para `hooks/useResidents.ts`.
