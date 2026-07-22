# Plan: editor de templates — `{{` abre drawer + autocomplete inline de variáveis

## Context

Bloco de backlog **"Editor de templates"** (adm.fonte, `features/settings`). O editor de
templates de documento (`TemplateEditor.tsx`, TipTap v3) hoje só oferece as variáveis pelo
`VariablesPanel` — barra colapsável fixa à direita (story 139/140): clicar insere no cursor,
arrastar solta o token. Não há nada que reaja ao usuário **digitar** `{{`.

Esta story faz o gesto natural de "abrir chaves" virar o atalho de inserção:

- Ao digitar `{{`, **duas coisas ao mesmo tempo**:
  1. o `VariablesPanel` **expande** (o drawer abre sozinho), e
  2. um **popup de autocomplete inline** aparece no cursor, filtrando a lista conforme se digita.
- Selecionar uma sugestão (clique, Enter ou setas) **substitui** o trecho `{{parcial` digitado
  pelo token completo `{{key}}`.

Decisão do usuário no planning: **os dois comportamentos juntos** (drawer + autocomplete), não um
ou outro.

### Decisões travadas

- **Fonte única das variáveis:** `VARIABLES[]` em `VariablesPanel.tsx` (linha 17) continua a fonte
  única. O autocomplete consome a MESMA lista — nada de duplicar rótulos/chaves. Se preciso, extrair
  `VARIABLES`/`TemplateVariable` para um módulo irmão (ex: `templateVariables.ts`) importado pelos
  dois, para não criar dependência circular editor↔panel. Preferir a extração se o import direto do
  panel puxar JSX/estado à toa.
- **Mecanismo:** usar o utilitário de suggestion do TipTap v3 — adicionar a dependência
  `@tiptap/suggestion@3.22.5` (mesma pin exata da família `@tiptap/*` já no `package.json`). Char de
  trigger `{{`. É o caminho idiomático do TipTap; evita reinventar um ProseMirror plugin cru.
- **Filtro:** casa o texto após `{{` contra `label` **e** `key`, **accent-insensitive** e
  case-insensitive (ex: `{{naci` → "Nacionalidade"; `{{resp` → os 3 de Responsável). Reusar/normalizar
  com o mesmo critério de busca já usado no app se houver util; senão `String.prototype.normalize('NFD')`.
- **Substituição:** ao escolher, apagar o range do trigger (`{{` + o que foi digitado) e inserir
  `{{key}}` inteiro — nunca duplicar as chaves. O cursor fica após o token.
- **Teclado:** ↑/↓ navegam, Enter/Tab confirmam, Esc fecha o popup (sem inserir). Clique no item
  também insere. Comportamento padrão do render de suggestion.
- **Fecha sem match:** se o texto após `{{` não casa nenhuma variável, o popup some (não bloqueia a
  digitação — o usuário pode estar escrevendo `{{` literal por outro motivo). Espaço/quebra de linha
  encerram o gatilho.
- **Drawer + popup coexistem:** abrir o drawer é colateral (chama o `setOpen(true)` do panel). O
  `VariablesPanel` precisa expor controle do estado `open` para o editor (ex: subir `open`/`onOpenChange`
  para o `TemplateEditor`, ou um `open` controlado). Manter o auto-collapse atual intacto.
- **Só o editor de template:** o `ActivityDescriptionEditor` (editor gêmeo de descrição de
  atividade) **não** ganha isto — ele não tem variáveis. Escopo restrito a `TemplateEditor` +
  `VariablesPanel`.

### Dependências

- Independente do item 2 do mesmo bloco (descrições visíveis das variáveis — story separada). Os
  dois tocam `VariablesPanel.tsx`; se implementados em paralelo, esperar leve conflito de merge na
  lista/estado do panel. Sem dep rígida de ordem.

## Desenho

1. **Dependência:** adicionar `@tiptap/suggestion@3.22.5` ao `apps/adm.fonte/package.json`
   (`pnpm --filter adm.fonte add @tiptap/suggestion@3.22.5`). Lockfile atualizado.
2. **(Se necessário) extrair** `VARIABLES` e `TemplateVariable` de `VariablesPanel.tsx` para
   `features/settings/components/templateVariables.ts`; `VariablesPanel` passa a importar de lá. Sem
   mudança de conteúdo da lista.
3. **Extension nova** `VariableSuggestion` (Extension do TipTap) em
   `features/settings/components/templateVariableSuggestion.ts(x)`:
   - configura o plugin de `Suggestion` do ProseMirror com `char: '{{'`, `startOfLine: false`.
   - `items({ query })` → filtra `VARIABLES` (label+key, accent/case-insensitive), limita a N (ex 8).
   - `command({ editor, range, props })` → apaga `range` e insere `props.key` (`{{key}}`).
   - `render()` → devolve um popup posicionado no cursor (component React montado via
     `ReactRenderer` do `@tiptap/react` + posicionamento por `clientRect`; sem lib externa de
     tooltip — posicionar com `position: absolute`/`fixed` a partir do rect). Lista com label + key,
     item ativo destacado, navegável por teclado.
   - `onStart` também dispara a abertura do drawer (callback injetado pela extension via `configure`).
4. **`VariablesPanel`:** tornar o `open` controlável de fora (subir estado para `TemplateEditor`, que
   passa `open`/`onOpenChange`; ou expor um ref/callback). O botão/aba e o auto-collapse seguem iguais.
5. **`TemplateEditor`:** registrar a extension nas `extensions` do `useEditor`, injetando o callback
   que faz `setVariablesOpen(true)`. Passar `open`/`onOpenChange` ao `VariablesPanel`.

## Validação e gate de cobertura

Frontend-only (adm.fonte). **Gate: código novo sem teste não fecha a story.**

- **Unit (Vitest) — funções puras primeiro (o editor contenteditable não roda de verdade no jsdom):**
  - `filterVariables(query)` (ou o `items` extraído como função pura): casos
    - query vazia → lista completa (ou top-N).
    - `naci` → só "Nacionalidade".
    - `resp` → os 3 de Responsável.
    - accent-insensitive: `endereco` casa "Endereço"; case: `NOME` casa "Nome completo".
    - match por key: `houseCity` casa `{{houseCity}}`.
    - sem match → lista vazia.
  - lógica de substituição (função pura que, dado o range/texto, devolve o token a inserir) — provar
    que insere `{{key}}` e não duplica as chaves.
- **Component (Vitest + Testing Library):** `VariablesPanel` continua com seus testes; adicionar caso
  de `open` controlado (abre quando a prop muda).
- **E2E (Playwright, `document-templates.spec.ts`):** cobrir o fluxo fim-a-fim que o jsdom não pega:
  1. abrir um template no editor,
  2. digitar `{{` no corpo → o drawer de variáveis fica visível **e** o popup de sugestões aparece,
  3. digitar `nome` → sugestão "Nome completo" aparece; Enter → o corpo contém `{{name}}` (e não
     `{{nome}}` nem `{{{{name}}`),
  4. salvar → persiste. Determinismo: rodar 2×.
- **Gate de cobertura:** `pnpm --filter adm.fonte vitest run --coverage` — ramo novo (util de filtro +
  substituição) ≥90%. O arquivo da extension/popup que depende de ProseMirror real pode entrar na
  exclusão de cobertura SE o comportamento fim-a-fim estiver coberto pelo e2e (mesmo padrão da story
  143 para o `TemplateEditor`). Sem `skip`/`only`/`xfail` injustificado.
- Build de contrato: **não** — não toca `packages/types` nem `api-client`. Postman inalterado.

## Fora de escopo

- Item 2 do bloco (descrições visíveis das variáveis no drawer) — story separada.
- Autocomplete no `ActivityDescriptionEditor` (não tem variáveis).
- Novas variáveis ou mudança na lista `VARIABLES`.
- Autocomplete no lado do backend / substituição real dos tokens (já existe, inalterado).
- Trigger por outro caractere que não `{{`.
