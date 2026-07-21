# Plan: Drag-and-drop das variáveis para o corpo do template

## Context

Bloco do BACKLOG **"Editor de templates de documentos"** — 2º item. **Depende da story 139**
(`VariablesPanel`, a barra colapsável de variáveis à direita), que passa a ser a **fonte de
arraste**. Contexto do bloco: melhorar a inserção de variáveis no editor (`TemplateEditor.tsx`,
adm.fonte).

Hoje só é possível inserir uma variável **clicando** nela (`insertVariable` →
`editor.chain().insertContent(key)`, insere no cursor). Pedido: permitir **arrastar** a variável da
barra e **soltar no corpo** do template, inserindo o token na posição do drop.

### Decisões travadas

1. **Manter o clique.** Drag-and-drop é **adicional** ao clique-para-inserir (não substitui). Os
   dois convivem.
2. **Fonte de arraste = linha da variável na `VariablesPanel`.** Cada linha vira `draggable`, com
   `dataTransfer` carregando o token literal (`text/plain` = `{{key}}`). Sem HTML custom no
   `dataTransfer` — texto puro, para o ProseMirror inserir como texto.
3. **Alvo do drop = corpo do editor, na posição do cursor de drop.** Usar `editorProps.handleDrop`
   do TipTap/ProseMirror para inserir o token nas coordenadas do drop (`view.posAtCoords`), não no
   fim nem no cursor anterior. Se o handler não tratar, o fallback padrão do ProseMirror para drop
   de `text/plain` já insere o texto na posição — garantir que o resultado final seja o token no
   ponto solto.
4. **Só o token nu.** O drop insere `{{key}}` (inclusive `{{signature}}` como texto) — o placeholder
   visual do `{{signature}}` é a **story própria** seguinte do bloco; aqui não se trata disso.
5. **Sem backend/contrato.** Puramente interação no editor do adm.

## Desenho

- **`VariablesPanel.tsx` (da story 139)**
  - Cada linha: `draggable`, `onDragStart={(e) => e.dataTransfer.setData('text/plain', key)}`
    (+ `effectAllowed = 'copy'`). Cursor `grab`/`grabbing` como affordance visual.
- **`TemplateEditor.tsx` — `useEditor.editorProps`**
  - Adicionar `handleDrop(view, event, _slice, _moved)`: ler `event.dataTransfer.getData('text/plain')`;
    se casar o padrão de token `{{...}}`, calcular `pos = view.posAtCoords({ left: event.clientX,
    top: event.clientY })` e inserir o texto ali (transação `tr.insertText` / comando equivalente),
    `event.preventDefault()`, retornar `true`. Caso contrário, retornar `false` (deixa o
    comportamento padrão — ex: colar imagem, já tratado no `handlePaste`).
  - Não quebrar o `handlePaste`/`handleClick` existentes.
- **Sem migration, sem contrato, sem Postman, sem backend.**

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail`
injustificado. Runner de unit do adm (Vitest) cobrindo o código novo (≥90% do escopo).

- **Unit — `VariablesPanel.test.tsx`:** `dragstart` numa linha seta `dataTransfer` com o token
  (`text/plain` = `{{name}}` etc.) — mock de `DataTransfer`.
- **Unit — handler de drop:** extrair a lógica do `handleDrop` para uma função pura testável
  (ex: `insertTokenAtCoords`/`handleVariableDrop`) e testar: token válido → insere na posição;
  string não-token → retorna false (no-op). Se a extração for inviável, cobrir via teste de
  integração do editor.
- **E2E (se aplicável, `test:adm`):** arrastar uma variável da barra e soltar no editor →
  o token aparece no corpo. (Se o driver do Playwright não simular DnD HTML5 de forma confiável,
  documentar e cobrir a lógica por unit — sem deixar o gate a descoberto.)
- **Regressão:** clique-para-inserir (story 139) continua funcionando; colar imagem
  (`handlePaste`) intacto.

## Fora de escopo

- Barra de variáveis colapsável em si (story 139 — pré-requisito).
- Placeholder visual do `{{signature}}` no editor (próxima story do bloco).
- Reordenar/editar variáveis; mudar o conjunto disponível.
- Drag-and-drop de outros elementos (imagens, blocos) — só variáveis.
