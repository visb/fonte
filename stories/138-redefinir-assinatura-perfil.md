# Plan: Botão "redefinir" para remover a assinatura no perfil

## Context

Bloco do BACKLOG **"Assinatura nos documentos"** — 4º e **último** item (1º→135, 2º→136, 3º→137).
Com esta story o bloco "Assinatura nos documentos" fecha.

Hoje o perfil (`SignatureSection.tsx`) permite **configurar/redesenhar** a assinatura
(`POST /staff/me/signature`), mas **não** permite **removê-la**. Uma vez desenhada, o usuário só
consegue trocar por outra, nunca voltar a "sem assinatura". Pedido: um botão **"redefinir"** que
remove a assinatura definida.

### Estado atual (investigado)

- **Backend:** `POST /staff/me/signature` (upload) em `staff.controller.ts` →
  `StaffService.uploadSignatureMe`. **Não há** endpoint de remoção. `staff.signatureUrl` guarda a
  URL; `StorageService.delete(url)` já apaga o arquivo (bucket ou `/uploads` local).
- **api-client:** `packages/api-client/src/modules/staff.ts` → `uploadMySignature(formData)`. Sem
  método de delete de assinatura.
- **Frontend adm:** `SignatureSection.tsx` mostra a assinatura (ou "Nenhuma assinatura
  configurada") + botão "Redesenhar"/"Configurar assinatura" que abre `SignatureDialog`. Hook
  `useUploadMySignature` em `features/staff/hooks/useStaff.ts` invalida `queryKeys.staffMe.current`.
- **UI de confirmação:** `components/ui/alert-dialog.tsx` (shadcn) já existe e é usado para deletes
  no app.

### Decisões travadas

1. **Novo endpoint `DELETE /staff/me/signature`.** Espelha o padrão do upload (self-service, sem
   `id`, resolve o staff pelo `user.userId`). Service `removeSignatureMe(userId)` → se houver
   `signatureUrl`: `storageService.delete(url)` e `update(id, { signatureUrl: null })`; devolve o
   `StaffMe` atualizado (mesmo contorno do upload). Idempotente: sem assinatura → no-op, 200.
2. **Confirmação antes de remover (decisão de UX confirmada com o usuário).** `AlertDialog`
   "Remover assinatura?" com ação destrutiva; só remove ao confirmar. Reusar
   `components/ui/alert-dialog.tsx` (mesmo padrão dos outros deletes) — **não** usar
   `window.confirm`/`alert` nativo.
3. **Botão "Redefinir" só aparece quando há assinatura.** Em `SignatureSection`, ao lado de
   "Redesenhar", com variante destrutiva (ex: `variant="ghost"`/`text-destructive`). Sem assinatura,
   só o botão "Configurar assinatura" (como hoje).
4. **Reaproveitar contrato existente.** `StaffMe.signatureUrl` já é `string | null` opcional
   (`packages/api-client/src/types.ts`) — remoção seta `null`, sem mudança de tipo.
5. **Postman.** Adicionar a rota `DELETE /staff/me/signature` na coleção (documentação viva da API).

## Desenho

- **Backend `services/api/src/modules/staff/`**
  - `staff.controller.ts`: `@Delete('me/signature')` → `staffService.removeSignatureMe(user.userId)`.
    Guard/decorators iguais aos demais `me/*`.
  - `staff.service.ts`: `removeSignatureMe(userId)` (resolve staff por userId) + `removeSignature(id)`
    interno espelhando `uploadSignature` (apaga arquivo se existir via `storageService.delete`,
    `update(id,{ signatureUrl: null })`, retorna staff atualizado).
- **api-client `packages/api-client/src/modules/staff.ts`**
  - `removeMySignature: (): Promise<StaffMe> => http.delete<StaffMe>('/staff/me/signature').then(r => r.data)`.
- **Frontend adm `apps/adm.fonte/src/features/`**
  - `staff/hooks/useStaff.ts`: `useRemoveMySignature()` — `mutationFn: () => api.staff.removeMySignature()`,
    `onSuccess` invalida `queryKeys.staffMe.current` (espelha `useUploadMySignature`).
  - `auth/components/SignatureSection.tsx`: quando `signatureUrl`, renderizar botão "Redefinir"
    (destrutivo) que abre `AlertDialog` de confirmação; ao confirmar chama a mutation. Estados de
    loading/erro via `getErrorMessage`. Se o componente crescer >~150 linhas ou juntar 2
    responsabilidades, extrair o confirm num subcomponente (`RemoveSignatureDialog`).
  - **Postman:** adicionar `DELETE /staff/me/signature` em `fonte-api.postman_collection.json`.

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail`
injustificado. `pnpm test:api:cov` + runner do adm (`pnpm test:adm` / unit Vitest do adm) cobrindo o
escopo novo (≥90%).

- **Backend unit — `staff.service.spec.ts`:**
  - `removeSignatureMe` com assinatura existente → chama `storageService.delete(url)` e persiste
    `signatureUrl: null`; retorna staff atualizado.
  - sem assinatura → não chama `delete`, retorna staff (idempotente).
- **Backend unit — `staff.controller.spec.ts`:** `DELETE me/signature` roteia para
  `removeSignatureMe(user.userId)`.
- **Backend e2e — `staff.e2e-spec.ts`:** fluxo autenticado — upload → `DELETE me/signature` →
  `GET me` sem `signatureUrl` (null); segunda remoção não falha (idempotente); sem token → 401.
- **Frontend unit — `SignatureSection.test.tsx`:** botão "Redefinir" só aparece com assinatura;
  clicar abre o `AlertDialog`; confirmar dispara `useRemoveMySignature`; cancelar não remove.
- **Contrato api-client — `contracts.test.ts`:** garantir que `removeMySignature` bate na rota
  `DELETE /staff/me/signature` (padrão dos demais testes de contrato).

## Fora de escopo

- URL quebrada / alinhamento / nome-sem-role da assinatura no PDF (stories 135, 136, 137).
- Remoção de assinatura de **outro** staff por admin (só self-service `me/*` nesta story).
- Qualquer mudança no `SignatureDialog` de desenho (só some o arquivo ao redefinir; redesenhar
  segue igual).
- Bloco "Editor de templates de documentos" do BACKLOG.
