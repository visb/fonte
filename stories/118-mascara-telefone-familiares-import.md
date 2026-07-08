# Plan: adm — máscara de telefone nos contatos de familiares (manual + import IA/lote) e DDD 41 padrão

## Context

Os telefones dos contatos de familiares no `adm.fonte` precisam sair sempre mascarados
no padrão `(DD) NNNNN-NNNN`. Hoje:

- **Cadastro manual já está OK.** `AddRelativeDialog`, o `contactPhone` do filho em
  `PersonalDataFields` e o `ReadmissionForm` já aplicam `withMask(register(...), maskPhone)`.
  Entram nesta story só como verificação/rede de teste, não como mudança funcional.
- **O gap real é o import (IA e lote).** O `withMask` só formata no `onChange` (quando o
  operador digita). O preview extraído pela IA carrega o telefone **cru** como
  `defaultValue`/valor inicial, então aparece sem máscara até alguém editar o campo — é o
  "telefone do filho fica sem máscara" relatado. Vale para:
  - o telefone do filho (`contactPhone`) pré-carregado via `previewToFormValues`;
  - o telefone do familiar em `ImportFichaRelatives` (input controlado, valor inicial cru
    vindo de `relativesFromPreview`).
  - a **aprovação direta pelo card** (`buildCommitPayloadFromPreview`), que nem passa pelo
    modal e hoje comita o telefone exatamente como a IA extraiu.

**Decisões travadas:**

- **DDD 41 como padrão só no import.** Quando o telefone extraído vier **sem DDD**
  (8 dígitos fixo ou 9 dígitos celular), assumir DDD **41** antes de mascarar. Se já vier
  com 10/11 dígitos, respeitar o DDD existente. No cadastro manual o operador digita o DDD
  — a regra de default 41 **não** se aplica ali (não reescrever o que a pessoa digitou).
- **Normalizar no boundary do import**, não em `maskPhone`. `maskPhone`/`withMask`
  continuam puros (formatação). A regra "prefixa 41 se faltar DDD" vai num helper novo de
  normalização usado só na conversão preview→form/commit — assim vale tanto para a
  aprovação pelo modal quanto pela direta no card, num ponto único.
- **Escopo frontend (`adm.fonte`).** A extração da IA (backend) continua devolvendo o
  telefone como veio; a normalização é do lado do adm.

Bloco compartilhado (import de filhos) — item irmão já na pauta: story 119 (UF padrão "PR"
no import IA/lote). Independente desta, mas mesma vizinhança de código (`importCommit` /
`ImportFichaModal`); implementar em sequência evita conflito.

## Desenho

Arquivos em `apps/adm.fonte/src`:

- `lib/masks.ts` — adicionar helper `normalizePhoneWithDefaultDDD(v: string, ddd = '41')`:
  extrai dígitos; se `length` for 8 ou 9 (sem DDD), prefixa o `ddd`; devolve já formatado
  por `maskPhone`. Strings vazias continuam vazias. Manter `maskPhone`/`withMask` intactos.

- `features/residents/lib/importCommit.ts`
  - `previewToFormValues`: ao copiar `contactPhone`, passar pelo
    `normalizePhoneWithDefaultDDD` (fica mascarado já no prefill do form do filho e no
    payload da aprovação direta).
  - `relativesFromPreview`: mapear `phone` por `normalizePhoneWithDefaultDDD` (mascara o
    telefone do familiar tanto no estado inicial do modal quanto na aprovação direta).

- `features/residents/components/import/ImportFichaRelatives.tsx`
  - Aplicar `maskPhone` no `onChange` do input de telefone do familiar (hoje grava o valor
    cru), espelhando o comportamento do `AddRelativeDialog`. O valor inicial já vem
    normalizado do `relativesFromPreview`.

Sem mudança de backend, de contrato (`@fonte/api-client`) nem de schema de banco. O commit
continua enviando o telefone como string mascarada (mesmo formato que o cadastro manual já
persiste hoje).

## Validação

Frontend-only (`adm.fonte`). Backend/contrato intocados.

- **Unit (vitest) — `lib/masks.test.ts`:** casos do novo helper
  `normalizePhoneWithDefaultDDD`:
  - 9 dígitos sem DDD → `(41) NNNNN-NNNN`;
  - 8 dígitos sem DDD → `(41) NNNN-NNNN`;
  - 10/11 dígitos (já com DDD) → mantém o DDD, não prefixa 41;
  - string vazia/só símbolos → vazio;
  - entrada já mascarada → idempotente.
- **Unit (vitest) — `importCommit.test.ts`:** `previewToFormValues` e `relativesFromPreview`
  devolvem telefone mascarado e com DDD 41 quando o preview traz telefone cru sem DDD
  (filho e familiar); e preservam DDD quando presente.
- **Component (vitest) — `ImportFichaRelatives.test.tsx`:** digitar dígitos no campo de
  telefone do familiar resulta em valor mascarado; valor inicial (vindo do preview) já
  aparece mascarado.
- **Regressão manual/teste — cadastro manual:** confirmar que `AddRelativeDialog` e o
  `contactPhone` do `PersonalDataFields` seguem mascarando na digitação (sem aplicar a
  regra de DDD 41 sobre o que o operador digitou).
- **E2E (`test:adm`) se houver spec de import:** aprovar um item de import cujo preview
  tenha telefone sem máscara/sem DDD e verificar que o valor exibido/commitado sai como
  `(41) …`.
- **Gate de cobertura:** código novo (helper + ramos de normalização) sem teste não fecha a
  story; rodar o runner de cobertura do `adm.fonte`, sem `skip`/`only` injustificado.
  `pnpm test:api:cov` não se aplica (backend intocado).

## Fora de escopo

- Alterar a extração da IA no backend (continua devolvendo o telefone cru).
- Normalização/DDD default no cadastro manual (só formatação na digitação, já existente).
- Máscara/DDD em telefones de outros domínios (staff, associados) — fora do pedido.
- Persistir telefone em formato E.164 / normalização no banco — não é isto.
