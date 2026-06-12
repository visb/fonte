# Plan: Tooltip de ações de link + estado reativo do botão unlink no editor de templates

## Context

Dois ajustes no editor de templates de documentos
(`apps/adm.fonte/src/features/settings/components/`), continuação da story 27 (que
adicionou link/unlink via popover na toolbar):

1. **Tooltip de ações ao clicar num link** — hoje o `Link` está com `openOnClick: false`
   (não navega ao clicar dentro do editor), mas também não oferece nenhuma ação. O usuário
   quer que, ao clicar num link (ou posicionar o cursor sobre ele), apareça um **tooltip
   flutuante** ancorado no link com ações: **Abrir** (em nova aba), **Editar** (URL) e
   **Remover** (unlink). É o padrão de editores tipo Notion/Google Docs.
2. **Botão "unlink" da toolbar não fica ativo ao posicionar o cursor** — bug de reatividade.
   `useEditor` do `@tiptap/react` v3 tem `shouldRerenderOnTransaction` default `false`, então a
   toolbar não re-renderiza em mudança de seleção/cursor; `editor.isActive('link')` fica
   defasado até uma transação que altere o documento. Resultado: ao só clicar/posicionar o
   cursor num texto com link, o `disabled` do botão unlink (e os estados ativos de
   negrito/itálico/alinhamento) não atualizam.

**Decisões do usuário (travadas):**
- Ao clicar num link, **não navegar** — abrir tooltip de ações. (Já não navega; falta o tooltip.)
- Botão unlink (e, por tabela, os demais botões de estado) deve refletir o cursor em tempo real.

**Abordagem (travada na implementação):**
- Tooltip via `BubbleMenu` de `@tiptap/react/menus` + `@tiptap/extension-bubble-menu` — ambos
  **já instalados** (peer do react v3), sem dependência nova. `shouldShow` customizado
  `({ editor }) => editor.isActive('link')` substitui o `shouldShow` default (que esconde em
  seleção vazia), então o tooltip aparece com o cursor dentro do link sem precisar selecionar.
  Como o `shouldShow` custom não checa foco, o tooltip permanece aberto enquanto o input de
  edição está focado (o editor perde foco, mas a seleção/link continua ativa).
- Reatividade: `shouldRerenderOnTransaction: true` no `useEditor`. Corrige o unlink e, de quebra,
  deixa todos os estados de toolbar (negrito/itálico/alinhamento/pt da fonte) reativos ao cursor.
  Documento de template é pequeno — custo de re-render desprezível; é o padrão recomendado do
  TipTap para toolbars reativas.
- Reuso de `normalizeLinkHref` (já exportado de `LinkToolbar.tsx`) no tooltip.

## Desenho

### Parte 1 — Tooltip de ações de link (feat)

Novo componente `LinkBubbleMenu.tsx` em `features/settings/components/`:
- `BubbleMenu` (`@tiptap/react/menus`) com `editor`, `pluginKey="linkBubble"`,
  `shouldShow={({ editor }) => editor.isActive('link')}`, `options={{ placement: 'bottom' }}`.
- **Modo ação** (default): href truncado + botões
  - **Abrir** (`ExternalLink`) → `window.open(href, '_blank', 'noopener,noreferrer')`.
  - **Editar** (`Pencil`) → entra no modo edição com a URL atual pré-preenchida.
  - **Remover** (`Link2Off`) → `editor.chain().focus().extendMarkRange('link').unsetLink().run()`.
- **Modo edição**: `Input` (pré-preenchido) + **Aplicar** (`Check`) / **Cancelar** (`X`);
  Enter aplica, Esc cancela. Aplicar usa `normalizeLinkHref` + `extendMarkRange('link').setLink`.
  Vazio = `unsetLink` (mesma regra do popover da toolbar).
- Reset do modo edição em `selectionUpdate` (mudar de link volta para o modo ação).
- Render do `<LinkBubbleMenu editor={editor} />` ao lado de `<EditorContent>` no `TemplateEditor`.

### Parte 2 — Estado reativo da toolbar (fix)

- `useEditor({ ..., shouldRerenderOnTransaction: true })` em `TemplateEditor.tsx`.
- Nenhuma mudança no `LinkToolbar.tsx` (o `disabled={!isLink}` passa a reagir ao cursor).

## Validação

- `pnpm build:types && pnpm build:api-client` (pré-req do adm) + `pnpm --filter adm.fonte build`
  e `tsc --noEmit` limpos.
- adm E2E (`pnpm test:adm`, spec `document-templates.spec.ts`): estender o describe
  "Editor de templates — link/unlink" para cobrir
  (a) clicar no link abre o tooltip com as ações; (b) "Remover" no tooltip desfaz o link;
  (c) posicionar o cursor no link deixa o botão unlink da toolbar habilitado.
- Sem mudança de endpoint → `fonte-api.postman_collection.json` inalterado; backend não tocado.

## Fora de escopo

- Edição de cor/estilo por-link (continua azul+sublinhado do CSS compartilhado).
- Âncoras internas / links para variáveis.
- Tooltip para imagens/tabelas (já têm seus próprios controles).
