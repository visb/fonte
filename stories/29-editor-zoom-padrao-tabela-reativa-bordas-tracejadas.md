# Plan: Zoom padrão 100%, toolbar de tabela reativa e bordas tracejadas em tabelas sem borda

## Context

Três ajustes de UX no editor de templates de documentos
(`apps/adm.fonte/src/features/settings/components/` + `packages/doc-styles/src/index.ts`):

1. **Zoom padrão 100%** — o frame A4 do editor (`A4EditorFrame`) abre em 75% (`useState(0.75)`).
   O usuário quer que **100%** venha selecionado por padrão.
2. **Ícones de edição de tabela só com a tabela ativa** — os controles +Col/−Col/+Lin/−Lin/
   mesclar/borda/etc. do `TableToolbar` já são condicionados a `editor.isActive('table')`, mas
   o estado fica **defasado**: o `TableToolbar` lê `editor.isActive('table')` no render e o
   `useEditor` (v3) não re-renderiza em mudança de cursor/seleção (`shouldRerenderOnTransaction`
   default `false`). Mesmo bug que a story 28 corrigiu para o botão unlink. Resultado: ao clicar
   dentro/fora de uma tabela, os controles não aparecem/somem na hora.
3. **Tabelas sem borda exibem bordas tracejadas no editor** — tabelas `no-border` (layout/
   multicoluna, story 21) ficam sem nenhuma linha, então no editor não dá pra ver a divisão das
   células ao editar. Adicionar **borda tracejada** nas células no **editor** para tornar a
   divisão visível. No **PDF** a tabela continua **sem borda nenhuma** (o tracejado é só guia de
   edição, não deve vazar para a impressão).

**Decisões do usuário (travadas):**
- Zoom inicial = 100%.
- Os controles de edição de tabela aparecem **somente** quando a tabela está selecionada ou o
  cursor está dentro dela — e devem reagir ao cursor em tempo real.
- Bordas tracejadas das células valem **só no editor**; o PDF mantém a tabela borderless.

**Decisão técnica (travada):** reatividade via `useEditorState` (igual à story 28), **não**
`shouldRerenderOnTransaction: true` — este último causa loop ("Maximum update depth exceeded")
ao combinar com o `BubbleMenu` (lição da story 28).

## Desenho

### Parte 1 — Zoom padrão 100% (`A4EditorFrame.tsx`)
- `const [zoom, setZoom] = useState<number>(1)` (era `0.75`). `ZOOM_OPTIONS` já inclui `1`.

### Parte 2 — Toolbar de tabela reativa (`TableToolbar.tsx`)
- Trocar as leituras diretas por `useEditorState`:
  ```ts
  const { insideTable, tableClass } = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      insideTable: e.isActive('table'),
      tableClass: (e.getAttributes('table').class as string | undefined) ?? '',
    }),
  });
  ```
- Derivar `hasBorder = !tableClass.includes(NO_BORDER_CLASS)`.
- `insideTable` passa a re-renderizar a toolbar ao entrar/sair de uma tabela → controles de
  edição aparecem/somem na hora. Os botões de inserção (Inserir tabela / 2 colunas) seguem sempre
  visíveis (comportamento atual mantido).

### Parte 3 — Bordas tracejadas só no editor (`packages/doc-styles/src/index.ts`)
- Em `EDITOR_PAGE_CSS`, **após** `elementRules('.a4-page')`, acrescentar uma regra de override
  escopada ao editor:
  ```
  .a4-page table.doc-table.no-border td,.a4-page table.doc-table.no-border th{border:1px dashed #c8c8c8}
  ```
  Por vir depois (mesma especificidade) vence o `border:none` herdado de `elementRules`. Como
  está só em `EDITOR_PAGE_CSS` e **não** em `DOCUMENT_PRINT_CSS`, o PDF não recebe o tracejado.
- Rebuild de `@fonte/doc-styles` (pacote buildado, consumido pelo editor e pelo backend).

## Validação

- `pnpm build:types && pnpm build:api-client` + `pnpm --filter @fonte/doc-styles build` +
  `pnpm --filter adm.fonte build` e `tsc --noEmit` limpos.
- Backend: `pnpm test:api` — `document-template.service.spec.ts` deve continuar verde; o PDF
  **não** deve conter a regra `dashed` (asserção de que o tracejado é editor-only, se o spec
  inspecionar o CSS do PDF).
- adm E2E (`pnpm test:adm`, spec `document-templates.spec.ts`):
  - zoom: ao abrir um template, o botão **100%** está ativo por padrão.
  - tabela reativa: cursor fora da tabela → sem `+Col`; cursor dentro → `+Col` visível.
  - tracejado: célula de tabela `no-border` tem `border-style: dashed` no editor.
- `fonte-api.postman_collection.json` inalterado (sem mudança de endpoint).

## Fora de escopo

- Persistência da preferência de zoom entre sessões.
- Bordas tracejadas no PDF (PDF segue borderless).
- Demais estados de toolbar reativos (negrito/itálico/pt da fonte) — fora do pedido.
- Handles/controles visuais dentro da própria célula (continua via toolbar).
