# Plan: Sanear double-mask de CPF/RG no adm.fonte (exibição + prefill de edição)

## Context

Descoberta durante o planning da story [[146-reintroducao-cpf-completo]]: o bug do CPF truncado
não é isolado da reintrodução — é um **padrão repetido** no `adm.fonte`.

Dois "mask" com o mesmo nome colidem:

- **Backend (redator, LGPD):** `SensitiveDataInterceptor` + `services/api/src/common/lib/mask.ts`
  redige o documento em respostas para não-privilegiados: `12345678901` → `***.***.789-00` (CPF),
  `***XX` (RG). Rotas de detalhe marcadas `@RevealSensitive()` entregam o valor completo só a
  ADMIN/COORDINATOR.
- **Frontend (formatador):** `maskCPF`/`maskRG` em `apps/adm.fonte/src/lib/masks.ts` são
  **formatadores puros** (dígitos crus → `000.000.000-00`). Não sabem distinguir "cru" de "já
  redigido".

Quando o formatador é aplicado sobre um valor que **já veio pronto do backend**, ele reprocessa:
`maskCPF('***.***.789-00')` tira os não-dígitos (`78900`) e devolve `789.00` — o "5 dígitos" do bug.

Sites levantados no `adm.fonte` (só este app usa `maskCPF/maskRG`):

**A) Exibição (double-mask → mostra `789.00`):**
- `features/staff/components/StaffOverviewTab.tsx:85-86` — `val(staff.cpf, maskCPF)` / `val(staff.rg, maskRG)`.
- `features/residents/components/tabs/OverviewTab.tsx:90-91` — `val(resident.cpf, maskCPF)` / idem RG.
- `features/residents/components/ReadmissionForm.tsx:159,165` — **já coberto pela story 146.**

**B) Prefill de form de edição (double-mask → risco de SALVAR CPF corrompido):**
- `features/staff/lib/staffSchema.ts:122-123` — `maskCPF(staff.cpf ?? '')` alimenta o form de edição.
- `features/residents/lib/residentSchema.ts:108-109` — `maskCPF(r.cpf ?? '')` idem.
  Se o valor vier redigido, o campo carrega `789.00`; um submit pode **persistir o CPF corrompido**.
  Pior que o caso de exibição — é integridade de dado.

**Não são bug** (input masks — formatam a digitação do usuário, entrada crua): `PersonalDataFields.tsx:67,70`,
`StaffPersonalTab.tsx:23,26`. Não mexer.

Decisão travada: introduzir helpers que **não reprocessam valor já resolvido** e aplicá-los em todos
os sites A e B. Reusar o helper criado na story 146 (`displayCpf`/`displayRg`); se 146 ainda não
aterrissou, esta story cria o helper em `lib/masks.ts` e a 146 passa a reusar. Não alterar a política
LGPD do backend — para não-privilegiados o valor redigido é o esperado.

## Desenho

1. Em `lib/masks.ts`, garantir os helpers de **exibição** `displayCpf`/`displayRg`:
   - contém `*` (redigido pelo backend) → devolve como veio;
   - dígitos crus completos (CPF 11 / RG) → formata com `maskCPF`/`maskRG`;
   - `null`/vazio → placeholder `—` (ou o que o call-site espera).
2. **Exibição (A):** trocar `val(staff.cpf, maskCPF)`/`val(resident.cpf, maskCPF)` (e RG) por
   `displayCpf`/`displayRg` em `StaffOverviewTab` e residents `OverviewTab`.
3. **Prefill (B):** em `staffSchema`/`residentSchema`, formatar o prefill **só quando o valor for
   dígito cru**; se vier redigido (`*`), não injetar `789.00` no campo editável — carregar como veio
   (o input mask cuidará da edição a partir dali) ou vazio, sem nunca produzir dígitos falsos.
   Objetivo: impossível persistir um CPF derivado de valor redigido.
4. Deixar `maskCPF`/`maskRG`/`withMask` puros como estão (input masks dependem deles).

Escopo frontend-only (`adm.fonte`). Sem backend/contrato.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Gate: **código novo sem teste
não fecha a story** (`pnpm --filter adm.fonte test:cov` verde, cobertura ≥90 do código tocado).

- **Unit dos helpers** (`masks.test.ts`): `displayCpf`/`displayRg` com dígito cru → formatado;
  com valor redigido `***.***.789-00` / `***XX` → devolvido as-is (nunca `789.00`); `null` → `—`.
- **Unit `StaffOverviewTab.test.tsx`**: staff com CPF redigido → mostra o redigido, não `789.00`;
  com CPF completo → formatado.
- **Unit residents `OverviewTab.test.tsx`**: idem para resident.
- **Unit `staffSchema`/`residentSchema`** (ou spec equivalente): prefill a partir de valor redigido
  não gera dígitos falsos no campo (não vira `789.00`); prefill a partir de valor cru completo é
  formatado corretamente.

## Fora de escopo

- `ReadmissionForm` (exibição) — story 146.
- Alterar a redação LGPD do backend / `@RevealSensitive`.
- Input masks de digitação (`withMask` + `PersonalDataFields`/`StaffPersonalTab`).
- Outros apps (ops/app/associados) — não usam `maskCPF`/`maskRG`.
