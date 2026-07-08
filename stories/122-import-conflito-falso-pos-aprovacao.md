# Plan: Não exibir alerta de conflito após aprovar a ficha do import

## Context

Bloco do BACKLOG: **melhorias no import de filhos** (fichas via IA + planilha em lote).
Contexto compartilhado com as stories 119, 120, 121.

**Bug relatado:** ao aprovar uma ficha do import em lote, o item vai para a **aba "Aprovados"**
mas continua exibindo o **alerta de conflito** "já existe filho cadastrado" — e o filho
"cadastrado" é justamente o que **acabou de ser aprovado** (conflito consigo mesmo). O alerta de
conflito só faz sentido **antes** de aprovar; depois de aprovar é óbvio que o filho existe no
banco.

**Causa raiz mapeada** (`apps/adm.fonte/.../components/import/ImportItemCard.tsx`):

- A verificação de conflito só é buscada com `status === 'ready'`
  (`useCheckImportConflict(name, cpf, { enabled: status === 'ready' })`, linha ~56).
- Mas o **render** do badge de conflito acontece dentro do bloco
  `(status === 'ready' || isImported)` e depende só de `conflicts.length > 0` (linha ~143) — ou
  seja, **continua pintando o badge quando o item já está `imported`**, usando o dado ainda em
  cache do React Query.
- Além disso, o `useCommitImport` invalida `queryKeys.residents.all` no sucesso (linha ~67 de
  `useBulkImport.ts`); como a chave `residents.importConflict(...)` fica sob esse prefixo, a
  query é marcada stale. Combinado com o timing do commit (o resident recém-criado passa a casar
  por nome/CPF), o cache pode conter **o próprio filho** como "conflito".

O mesmo vale para o badge de `sessionConflictName` (conflito com outro filho aprovado na mesma
sessão): pós-aprovação também não deve mais alertar.

## Desenho

Correção **frontend-only** e localizada em `ImportItemCard.tsx`: o alerta/badge de conflito
(e o de `sessionConflictName`) só devem aparecer **antes** de aprovar, i.e. quando
`status === 'ready'`.

1. Trocar a condição de render dos badges de conflito para exigir `status === 'ready'`:
   - `conflicts.length > 0 && status === 'ready'` → badge de conflito.
   - `sessionConflictName && status === 'ready'` → badge de conflito de sessão.
   (Hoje ambos vivem no bloco `ready || isImported`; passam a renderizar só no caso `ready`.)
2. `blockedReason` (que desabilita o botão Aprovar) já só importa quando o botão existe
   (`status === 'ready'`, linha ~190) — manter como está; serve só ao pré-aprovação.
3. A query de conflito já é `enabled: status === 'ready'` — manter. Gatear o **render** por
   status elimina o badge fantasma mesmo com dado stale no cache, sem depender de invalidação.

Nada muda no backend: `ImportService.checkConflict` continua correto para o uso pré-aprovação
(comparar a ficha a importar contra os já cadastrados). O ajuste é puramente de exibição no card
do item já importado.

## Validação

Camada tocada: **frontend adm.fonte** (vitest + RTL). Backend intocado.

- **`ImportItemCard.test.tsx`** (estender):
  - item `status: 'imported'` com `conflictQuery` retornando conflito → **não** renderiza o badge
    de conflito nem o de `sessionConflictName` (regressão do bug).
  - item `status: 'ready'` com conflito real → **renderiza** o badge e desabilita "Aprovar"
    (comportamento pré-aprovação preservado).
  - item `status: 'ready'` sem conflito → sem badge, "Aprovar" habilitado.
  - `sessionConflictName` presente: aparece só em `ready`, some em `imported`.

**Gate de cobertura (obrigatório):** código novo/alterado sem teste não fecha a story. Rodar o
runner de cobertura do adm.fonte (`pnpm --filter adm.fonte test -- --coverage`), ≥90% do
código alterado. Sem `skip`/`only`/`xfail` injustificado. `pnpm test:adm` (Playwright) não é
exigido — mudança de condição de exibição, sem novo fluxo; manter verdes specs de import
existentes que toquem o card. Nenhuma mudança de endpoint → `fonte-api.postman_collection.json`
inalterado.

## Fora de escopo

- Excluir o próprio resident no backend `checkConflict` — desnecessário: o gate por status no
  front resolve, e a checagem de backend continua válida para o uso pré-aprovação.
- Rever a estratégia de invalidação do `useCommitImport` — funciona para residents/houses; não é
  a origem do alerta fantasma uma vez gateado o render.
- Fluxo de conflito do wizard IA single-file (`ImportFichaModal`/`ImportReviewStep`) — o conflito
  ali é sempre pré-aprovação (o modal fecha ao aprovar; item importado não reabre ficha).
