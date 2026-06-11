# Plan: Link/unlink no editor de templates + preservar parágrafos vazios no PDF

## Context

Dois ajustes no editor de templates (`apps/adm.fonte/src/features/settings/components/TemplateEditor.tsx`)
e no CSS de documento compartilhado (`packages/doc-styles/src/index.ts`):

1. **Link/unlink** — o editor não tem como inserir hiperlink. Adicionar a extensão de link do
   TipTap + controle na toolbar. Texto com link deve ser **explicitamente visível** com estilo
   padrão: **azul + sublinhado**, tanto no editor quanto no PDF exportado (CSS compartilhado).
2. **Parágrafos vazios ignorados no PDF** — bug. O usuário insere linhas em branco (parágrafos
   vazios) para espaçamento, mas elas somem no PDF. Já houve uma tentativa de fix
   (commit `ef35513`, regra `p:empty::before{content:"\00200b"}` em `doc-styles/index.ts`) que
   **não resolveu** — o zero-width-space (U+200B) tem largura zero e o parágrafo continua
   colapsando. Trocar por abordagem robusta.

**Decisões do usuário (travadas):**
- Os dois itens numa story só, uma branch, dois commits (`feat` do link + `fix` do parágrafo).
- Entrada de URL via **popover com input** (padrão shadcn do adm.fonte), não `window.prompt`.
- Estilo de link: **azul e sublinhado** (padrão explícito), no editor e no PDF.

**Versões (verificado):** `@tiptap/extension-link@3.22.5` já está no `node_modules` raiz e casa
com `@tiptap/core@3.22.5`. Sem risco de version lock. Confirmar que entra como dependência direta
em `apps/adm.fonte/package.json` (não só hoisted).

## Desenho

### Parte 1 — Link/unlink (feat)

**Editor (`TemplateEditor.tsx`):**
- Importar e registrar `Link` (`@tiptap/extension-link`) nas `extensions` do `useEditor`.
  - Configurar: `openOnClick: false` (não navegar ao clicar dentro do editor), `autolink: true`,
    `HTMLAttributes: { class: 'doc-link', rel: 'noopener noreferrer nofollow', target: '_blank' }`.
  - **Não** definir cor inline na extensão — a cor/sublinhado vem do CSS compartilhado (item de
    estilo abaixo), p/ o editor casar 1:1 com o PDF.
- Toolbar: novo grupo com botão **Link** (ícone `Link` do lucide) e **Unlink** (`Link2Off`).
  - Botão Link abre um **popover** (shadcn `Popover` de `@/components/ui/popover` — conferir se já
    existe no projeto; senão usar o primitivo disponível) com:
    - `Input` de URL (pré-preenchido com o href atual se o cursor está sobre um link).
    - Botões "Aplicar" e "Remover".
  - Estado `active` do botão Link = `editor.isActive('link')`.
  - Aplicar: `editor.chain().focus().extendMarkRange('link').setLink({ href }).run()`.
    Validar/normalizar URL (prefixar `https://` se não tiver esquema; recusar vazio).
  - Remover: `editor.chain().focus().extendMarkRange('link').unsetLink().run()`.
  - Botão Unlink direto na toolbar também (desabilitado quando `!isActive('link')`).
- Extrair o popover de link como componente próprio (`LinkPopover` ou dentro de um arquivo de
  toolbar) p/ não inflar o `TemplateEditor` (já tem ~150 linhas de toolbar) — regra CLAUDE.md de
  decomposição.

**CSS compartilhado (`packages/doc-styles/src/index.ts`) — `elementRules`:**
- Adicionar regra de link visível, escopada igual às demais:
  ```
  ${s}a,${s}a.doc-link{color:#0645ad;text-decoration:underline}
  ```
  (azul de link + sublinhado). Vale p/ PDF (global) e editor (`.a4-page a`).
- Rebuild de `@fonte/doc-styles` se for pacote buildado (conferir; senão é consumido direto do src).

### Parte 2 — Preservar parágrafos vazios no PDF (fix)

- **Reproduzir primeiro**: criar template com linhas em branco entre parágrafos, exportar PDF,
  confirmar o colapso. Inspecionar o `getHTML()` do editor p/ ver como o parágrafo vazio
  serializa (`<p></p>` vs `<p><br></p>`).
- **Causa provável**: `p:empty::before{content:"\00200b"}` — U+200B tem largura/altura efetiva
  insuficiente p/ gerar uma line box visível, e `p{overflow:hidden}` pode estar cortando.
- **Fix robusto** (escolher na implementação conforme o que a repro mostrar, preferência nesta
  ordem):
  1. Trocar o conteúdo do `::before` por non-breaking space `\00a0` (U+00A0, tem largura real)
     **ou** garantir altura mínima: `${s}p:empty{min-height:1.2em}` (1.2 = line-height do corpo).
  2. Se `:empty` não casar (caso o parágrafo vazio venha como `<p><br></p>`), tratar também esse
     caso — `p` contendo só `<br>`.
- Manter a regra dentro de `elementRules` (compartilhada editor+PDF) p/ a prévia na tela continuar
  batendo com o PDF (DoD da story 24).
- Garantir que o `overflow:hidden` do `p` não anula a altura mínima; ajustar se necessário.

## Validação

- `pnpm build:types && pnpm build:api-client` (pré-req do adm) + `pnpm --filter adm.fonte build`
  e `tsc --noEmit` limpos.
- Se `@fonte/doc-styles` for buildado: `pnpm --filter @fonte/doc-styles build`.
- Backend: `pnpm test:api` — o `document-template.service.spec.ts` deve continuar verde; adicionar
  asserção de que o CSS do link e a regra de parágrafo vazio estão no HTML gerado (`wrapPage`/
  `DOCUMENT_PRINT_CSS`).
- **Verificação manual do PDF** (a parte que os testes não cobrem): gerar o PDF de um template com
  link e com linhas em branco; confirmar link azul+sublinhado e blank lines preservadas. Usar a
  rota de geração de PDF de resident (`resident.controller.ts`).
- adm E2E (`pnpm test:adm`, spec `document-templates.spec.ts`): cobrir inserir link via popover e
  remover, se o spec já exercita o editor.
- Atualizar `fonte-api.postman_collection.json` **só se** algum endpoint mudar (não deve — é
  frontend + CSS; o PDF reusa rota existente).

## Fora de escopo

- Edição visual de cor de link por-link (cor é padrão fixa azul/sublinhado).
- Âncoras internas / links para variáveis.
- Autolink de texto colado além do default da extensão.
- Mudar o pipeline de variáveis ou a geometria A4.
