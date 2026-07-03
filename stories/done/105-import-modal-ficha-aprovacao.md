# Plan: Modal da ficha completa editável e aprovação do import

> **Status: PLANEJAMENTO.** Story-filha 5 de [[100]]. Depende de [[103]] e [[104]]. Após aprovação.

## Context

Filha 5 do epic [[100]] — fecha o fluxo. A partir de cada card da fila ([[104]]), o usuário pode
**abrir um modal com a ficha completa editável** e **aprovar a importação** (pelo card ou pelo
modal). Aprovar chama o commit atômico ([[103]]), que persiste resident + relatives + contribuições
retroativas. Conflito é explicitado inline antes de deixar aprovar.

### Decisões travadas

- **Um modal reaproveitando os campos do wizard atual** (`ResidentFormSections` /
  `features/residents/components/import/*`) — não recriar formulário. Todos os campos preenchíveis;
  pré-carregados com o resultado enriquecido da [[102]].
- **Form com `react-hook-form` + `zod`** (nunca `useState` para campos — CLAUDE.md); reusar o schema
  do resident já existente.
- **Aprovação disponível nos dois lugares** (card e modal). Ambos disparam o mesmo `useCommitImport`.
- **Conflito bloqueia a aprovação**: se a checagem ([[103]]) acusou conflito por nome/CPF, o botão
  Aprovar fica desabilitado com o alerta explicitando qual filho conflita; o usuário resolve fora do
  fluxo (o epic decidiu não mesclar).
- Após aprovar com sucesso, o card vira estado `imported` (não some — dá feedback do que já entrou) e
  sai da contagem de pendentes. Invalidar a query de `residents` (lista) via query key.

## Desenho

### Frontend (`adm.fonte`, feature `residents`)

- **Componente** `ImportFichaModal` (dialog autossuficiente — busca/recebe só o necessário, sem prop
  drilling excessivo): recebe o `ImportPreviewResult` do item e `houses`; renderiza a ficha completa
  editável reusando as seções do wizard; botão **Aprovar** interno.
- **`ImportItemCard`** ([[104]]) ganha: botão **Ver ficha** (abre o modal) e botão **Aprovar**
  (commit direto). Ambos desabilitados quando `matchStatus`/conflito exigir atenção; tooltip/motivo.
- **Hook** `useCommitImport()` em `features/residents/hooks/useBulkImport.ts`: mutation →
  `api.residents.commitImport` ([[103]]); on success invalida `queryKeys.residents.*` e marca o item
  como `imported`; on error → `getErrorMessage`.
- **Alerta de conflito** inline no card e no topo do modal, listando o(s) filho(s) existentes que
  batem (nome/cpf) e desabilitando Aprovar. Também sinaliza **conflito com filho já importado nesta
  sessão** (mesmo cpf/nome já aprovado na fila).
- Estados/erros via componentes compartilhados e `getErrorMessage`.

## Validação

Gate: **código novo sem teste não fecha a story** (runner de cobertura do `adm.fonte`; sem
`skip`/`only`/`xfail` injustificado).

- **Unit (Vitest/RTL)**:
  - `ImportFichaModal`: pré-carrega os campos com o preview; edição altera o payload enviado;
    validação `zod` barra submit inválido.
  - `useCommitImport`: on success marca `imported` e invalida a query de residents; on error mostra
    a mensagem.
  - Botão Aprovar desabilitado quando há conflito (existente ou já-importado-na-sessão), habilitado
    quando limpo.
- **`pnpm test:adm`** (Playwright, fluxo ponta-a-ponta do epic — fecha o E2E citado em [[100]]):
  subir planilha → arrastar `.docx` → abrir modal, editar um campo, aprovar → filho aparece na lista
  de residents com os dados e as contribuições; tentar aprovar um com conflito → bloqueado com alerta.
- `pnpm build:api-client` se tocar contratos do cliente.

## Fora de escopo

- Endpoints backend (fichas [[101]]/[[102]]/[[103]]).
- Fila/cards/dropzone (fica em [[104]]).
- Edição em massa (aprovar todos de uma vez) — aprovação é por item nesta entrega.
