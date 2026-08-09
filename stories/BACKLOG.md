# Backlog

- **Idempotência de escrita no backend (`clientRequestId`)** — o replay da outbox offline do
  `ops.fonte` (epic [[167]], filha [[169]]) não é idempotente do lado do servidor: se a requisição
  chega ao backend mas a resposta se perde, o item continua na fila e o reenvio **duplica** o
  lançamento. Crítico para movimento de estoque (`storeroom`/`supply_room`), que não tem estorno
  (`BUSINESS_RULES.md`) — a correção só é possível por lançamento novo. Escopo: aceitar um
  `clientRequestId` (UUID gerado no cliente, já enviado desde a [[169]]) nos endpoints de escrita
  de campo (censo, ocorrências, almoxarifado, despensa, venda de rua, atividades), persistir com
  restrição de unicidade e devolver o resultado original em vez de criar de novo. Envolve
  DTO + migration + Postman + `test:api:e2e`.
