# Backlog

## Achados da rodada de autorun 182–184 (2026-08-17)

Detalhe e evidência em `stories/done/PROGRESS-182-184.md` → "Resumo final".

- **ops.fonte: hidratação offline semeia a ficha do filho sem `houseId`.**
  `GET /houses/:id/residents` devolve linha enxuta (`id,name,status,entryDate,photoUrl,photoThumbUrl`)
  e `hydrateResidentQueries` (`apps/ops.fonte/lib/offline/store/hydrate.ts:72-74`) grava essa linha na
  chave de **detalhe** como dado **fresco**, sem o `needsServerConfirmation` que a mesma função aplica
  a `residents.byHouse`. Com `staleTime: 30_000` (`lib/queryClient.ts:31`) a ficha aberta logo após o
  login não rebusca: `resident.houseId` fica `undefined` → `useInventoryCatalog('')` desabilitado →
  seletor de produto vazio, e `ChangeMinistryModal` fica escondido
  (`features/residents/pages/ResidentDetailPage.tsx:112,138`). Contornado hoje por um `swipe`
  (pull-to-refresh) em `e2e/product-contributions.yaml`. Consertar marcando a chave de detalhe como
  pendente de confirmação na hidratação (ou fazendo a listagem carregar `houseId`) e **remover o
  `swipe` do spec**.

- **Declaração de contribuição em produtos é inacessível ao SERVANT.**
  `GET /residents/:id/receivables` é `@Roles(ADMIN, COORDINATOR)`
  (`services/api/src/modules/resident/resident.controller.ts:391-395`); com operador a tela mostra
  "Erro ao carregar o carnê do filho." A restrição é deliberada e espelhada no pacote offline
  (`offline-sync.service.ts:99-102`, com teste "o carnê NÃO desce para o servo"), então o e2e passou a
  logar como coordenador. Decidir se o servo deve declarar contribuição em produtos — se sim, é
  mudança de permissão no backend + o que o pacote offline entrega.

- **Suíte Maestro do ops.fonte não é 100% estável em execução seguida.**
  Numa batelada, `census` e `dashboard` falharam em ~7s cada (11/13) e passaram isolados e na batelada
  seguinte sem qualquer edição — hiccup de launch do driver, não asserção. Investigar retry/espera de
  launch antes de considerar a suíte confiável em CI.
