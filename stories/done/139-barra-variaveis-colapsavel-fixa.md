# Plan: Barra de variáveis colapsável, fixa à direita (1 variável por linha)

## Context

Bloco do BACKLOG **"Editor de templates de documentos"** — 1º dos 3 itens. Contexto compartilhado
do bloco: melhorar a experiência de inserir variáveis no editor de template (`TemplateEditor.tsx`,
adm.fonte). Os outros itens do bloco (drag-and-drop das variáveis; placeholder do `{{signature}}`)
viram stories próprias. **A story 140 (drag-and-drop) depende desta**, pois esta barra passa a ser
a fonte de arraste.

### Estado atual (investigado)

- `apps/adm.fonte/src/features/settings/components/TemplateEditor.tsx` — o quadro de variáveis fica
  **no rodapé**, dentro de um bloco `rounded-md border bg-muted/30`, num `grid grid-cols-1
  sm:grid-cols-2`. Cada item é um `<button>` com a chave `{{...}}` (mono) + label + descrição.
- Lista em `const VARIABLES` (key/label/description) no mesmo arquivo.
- Clicar insere via `insertVariable(key)` → `editor.chain().insertContent(key)` + copia pro
  clipboard + feedback "✓ inserido" por 1,5s.

### Pedido

Mover o quadro para uma **barra vertical colapsável**, `position: fixed` **à direita**, mostrando
**uma variável por linha**.

### Decisões de produto (confirmadas com o usuário)

1. **Estado inicial recolhido.** A barra abre **fechada**, como uma aba/botão fixo na borda direita
   (ex: "Variáveis"); o usuário expande quando precisa. Assim não cobre a folha A4 por padrão.
2. **Cada linha mostra rótulo + chave.** Ex: **"Nome completo"** com `{{name}}` (mono, menor)
   junto. Mantém a legibilidade do label atual + a chave literal visível. A descrição pode virar
   `title`/tooltip (não ocupa linha).

### Decisões travadas

3. **Comportamento de inserção preservado.** Clicar numa linha continua chamando `insertVariable`
   (insere no cursor + copia + feedback). Nada de regressão no fluxo atual.
4. **Extrair componente próprio.** Criar `VariablesPanel` (ou nome equivalente) em
   `features/settings/components/`, recebendo `editor` (ou um callback `onInsert`) — o
   `TemplateEditor` já é grande; a barra não deve inchá-lo. Segue a regra de decomposição
   (componente < ~150 linhas, responsabilidade única).
5. **`position: fixed` à direita, colapsável.** Aba/botão fixo na borda direita quando recolhida;
   ao expandir, painel vertical com a lista rolável (`overflow-y:auto`, `max-height` da viewport).
   Largura contida (não vazar em telas estreitas); z-index acima do conteúdo, abaixo de dialogs.
   Estado aberto/fechado em `useState` local do painel.
6. **Sem mudança de backend/contrato.** A lista `VARIABLES` continua no frontend; só muda a
   apresentação. Pode ser movida para junto do novo componente (ou um `constants.ts` da feature) se
   ajudar a organização.

## Desenho

- **`apps/adm.fonte/src/features/settings/components/VariablesPanel.tsx`** (novo)
  - Painel `position: fixed` à direita, colapsável (default recolhido: aba/botão "Variáveis").
  - Lista `VARIABLES` uma por linha: rótulo + chave (mono); descrição como `title`.
  - Ao clicar, chama `onInsert(key)` (ou recebe `editor` e insere). Mantém feedback "inserido".
  - `overflow-y:auto` + `max-height`; largura responsiva; z-index abaixo de dialogs/toolbar sticky.
- **`TemplateEditor.tsx`**
  - Remover o bloco de variáveis do rodapé; renderizar `<VariablesPanel .../>`.
  - Mover `VARIABLES` e `insertVariable` (ou o callback de insert) para o novo componente/constants,
    mantendo o clipboard + feedback.
- **Sem backend, sem contrato, sem Postman, sem migration.**

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail`
injustificado. Runner de unit do adm (Vitest) cobrindo o novo componente (≥90% do escopo novo); se
houver e2e de template no `test:adm`, mantê-lo verde.

- **Unit — `VariablesPanel.test.tsx` (novo):**
  - inicia **recolhido** (lista não visível; só a aba/botão).
  - expande ao clicar na aba; recolhe de volta.
  - renderiza **uma variável por linha** com rótulo + chave (`{{name}}` etc.).
  - clicar numa variável chama `onInsert` com a chave correta e mostra o feedback "inserido".
- **Unit — `TemplateEditor`:** garantir que o painel é renderizado e que o antigo grid de rodapé
  não existe mais (evita duplicidade); demais funções do editor intactas.
- **E2E (se aplicável, `test:adm`):** abrir a barra, clicar numa variável, verificar que o token
  entra no editor.

## Fora de escopo

- Drag-and-drop das variáveis para o corpo (story 140 — depende desta).
- Placeholder visual do `{{signature}}` no editor (story própria do bloco).
- Qualquer mudança na renderização/substituição das variáveis no backend (as stories de assinatura
  já cobriram o que era do render).
- Mudar o conjunto de variáveis disponíveis.
