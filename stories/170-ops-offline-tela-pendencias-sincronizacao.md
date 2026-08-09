# Plan: ops.fonte offline — tela de pendências de sincronização

> Filha de [[167]]. Depende de [[169]] (fila e dead-letter existindo).
> Ordem: [[168]] → [[169]] → 170 → [[171]].

## Context

Fatia 3 do epic [[167]]. Com fila persistida, o operador precisa **ver** o que ainda não subiu e
o que foi recusado — senão o offline vira caixa-preta e o coordenador não sabe se a contagem do
pátio chegou. Decisão travada no epic: **nada some em silêncio**; item recusado pelo servidor fica
visível com o erro e só sai por ação explícita (reenviar ou descartar).

Estado: hoje não existe nenhuma tela desse tipo, nem indicação de estado de envio em lugar nenhum
do app. As rotas ficam em `app/(app)/<domínio>/` e as features em `features/<domínio>/`
(vertical slice, CLAUDE.md).

### Decisões travadas

1. **Feature nova `features/sync/`** + rota `app/(app)/sync/index.tsx`. Não pendurar em `profile`
   nem em `house-settings` — é assunto próprio e vai ser referenciado por badge de outras telas.
2. **Duas seções na mesma tela**: "Aguardando envio" (pausadas/pendentes, vindas de
   `usePendingMutations`) e "Não enviadas" (dead-letter, com o erro do backend). Estados diferentes,
   ações diferentes; misturar confunde.
3. **Ações**: em "Não enviadas" → **Reenviar** (recoloca na fila com as mesmas variáveis) e
   **Descartar** (confirmação obrigatória — é perda deliberada de um lançamento de campo). Em
   "Aguardando envio" → só **Descartar**, também confirmado. Não inventar "editar item da fila".
4. **Rótulo humano por chave de mutation**, num `features/sync/constants.ts`
   (`['storeroom','createMovement']` → "Movimento de almoxarifado"), como o repo já faz com
   labels/variantes por domínio. Chave sem rótulo cai num fallback legível, e o teste de catálogo
   pega a chave nova sem rótulo.
5. **Badge de contagem na home** (`app/(app)/index.tsx`), somando pendentes + não enviadas, levando
   para a tela. Sem badge, ninguém abre a tela.
6. **Descartar apaga o anexo** correspondente via `discardOutboxFile` ([[169]]) — não deixar arquivo
   órfão em `documentDirectory/outbox/`.
7. Sem mudança de backend, contrato ou Postman.

## Desenho

### `features/sync/hooks/useSyncQueue.ts` (novo)

- `useSyncQueue()`: junta `usePendingMutations()` ([[169]]) e `deadLetter.list()` num modelo único
  `{ id, label, detail, status: 'pending'|'failed', error?, createdAt }`, ordenado por data.
- `useSyncQueueCount()`: só o total, para o badge (usada pela home; evita a home montar a lista).
- `useRetryFailed()` / `useDiscardItem()`: mutations locais (sem rede) que mexem na fila e na
  dead-letter.

### `features/sync/components/`

- `SyncItemCard.tsx` — um item: rótulo, detalhe curto (ex. item + quantidade), horário, badge de
  status e, quando falhou, a mensagem do backend.
- `SyncSection.tsx` — cabeçalho + lista de uma seção.
- `DiscardItemDialog.tsx` — confirmação de descarte, autossuficiente (CLAUDE.md: sem prop drilling).
- Lista com `FlatList` e item **extraído** (CLAUDE.md: nunca item inline complexo).

### `features/sync/pages/SyncPage.tsx` (nova)

- Só orquestra: `LoadingState`/`EmptyState`/`ErrorState` equivalentes do app, duas `SyncSection`,
  banner de offline já vem do layout ([[168]]). Nada de `useQuery`/`useMutation` direto na page
  (CLAUDE.md).

### `app/(app)/sync/index.tsx` + `app/(app)/index.tsx`

- Rota fina reexportando a page (padrão do app).
- Home ganha o badge com `useSyncQueueCount()`, navegando para `/sync`.

## Validação

**Unit (Jest/RTL — `pnpm test:ops:unit`)**

- `useSyncQueue.test.tsx`: mescla pendentes + dead-letter, ordena por data, status correto de cada
  origem; `useSyncQueueCount` soma as duas origens; lista vazia → contagem 0.
- `useRetryFailed`: reenvio remove da dead-letter e recoloca na fila; se a rede ainda está fora, o
  item volta para "Aguardando envio" (não para "Não enviadas").
- `useDiscardItem`: descarte remove da origem certa **e** chama `discardOutboxFile` quando o item
  tem anexo.
- `SyncItemCard.test.tsx`: mostra a mensagem do backend em item falho; não mostra em pendente.
- `DiscardItemDialog.test.tsx`: só descarta após confirmação; cancelar não altera a fila.
- `SyncPage.test.tsx`: estado vazio ("Nada pendente"); duas seções renderizadas quando há itens dos
  dois tipos; seção sem itens não aparece.
- `constants.test.ts`: **toda** chave de `OUTBOX_MUTATION_KEYS` ([[169]]) tem rótulo — o teste
  falha quando alguém adiciona chave nova sem rótulo.

**E2E web (Playwright — `pnpm test:ops:e2e`)**

- Estender `e2e-web/offline-outbox.spec.ts` (ou spec irmão): offline → criar lançamento → badge da
  home mostra 1 → abrir `/sync` e ver o item em "Aguardando envio" → voltar a rede → item some e o
  badge zera.
- Caso de rejeição: forçar 422 no endpoint via `page.route` → item aparece em "Não enviadas" com a
  mensagem do backend → **Descartar** com confirmação → lista esvazia e o badge zera.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:ops:unit:cov`; **não reduzir** a cobertura de
`features/` e `lib/`. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md). Story
frontend-only: **não** exige `pnpm test:api:cov`, `build:types`, `build:api-client` nem Postman.

## Fora de escopo

- Plugar os fluxos de campo nas mutations retomáveis ([[171]]).
- Editar o payload de um item da fila antes de reenviar.
- Notificação push/local avisando que algo falhou.
- Exportar/compartilhar a fila para suporte.
