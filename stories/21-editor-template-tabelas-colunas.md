# Plan: Tabelas e texto em múltiplas colunas no editor de templates

## Context

O editor de templates de documento (`apps/adm.fonte/src/features/settings/components/TemplateEditor.tsx`) é um TipTap (ProseMirror) com `StarterKit` + extensões customizadas (FontSize mark, ParagraphIndent, ResizableImage, TextAlign, Placeholder). O conteúdo é salvo como **HTML** em `document_templates.content` e o PDF é gerado por **puppeteer** em `document-template.service.ts` (`renderForResident` → `page.pdf({ format: 'A4', margin: 40px })`), reusando o mesmo HTML.

Hoje **não há** como inserir tabelas nem dispor texto em múltiplas colunas. O usuário precisa de:
- Inserir **tabelas** no conteúdo (linhas/colunas, ex.: quadro de dados, assinaturas lado a lado).
- Dispor **texto em múltiplas colunas** (ex.: duas colunas de texto na mesma faixa).

> Tabela e "multicoluna" se resolvem com a mesma primitiva (tabela): uma tabela **sem bordas** vira layout de colunas; **com bordas** vira quadro de dados. Ver §Refinamentos.

---

## Implementação

### 1. Dependência

`@tiptap/extension-table` (Table, TableRow, TableHeader, TableCell). Versão **compatível** com a do `@tiptap/react`/`@tiptap/core` já no `package.json` do adm (conferir antes de instalar — alinhar major/minor com `@tiptap/starter-kit`).

```
pnpm --filter adm.fonte add @tiptap/extension-table
```

### 2. Registrar extensões no editor — `TemplateEditor.tsx`

No array `extensions` do `useEditor`:

```ts
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';

// ...
Table.configure({ resizable: true, HTMLAttributes: { class: 'doc-table' } }),
TableRow,
TableHeader,
TableCell,
```

`resizable: true` dá colunas redimensionáveis (consistente com o ResizableImage já existente).

### 3. Toolbar — novo grupo "Tabela"

Adicionar, após o grupo de imagem/HR, um botão **Inserir tabela** (ícone `Table` do lucide-react) e, quando o cursor está dentro de uma tabela (`editor.isActive('table')`), expor os controles contextuais:

- Inserir tabela: `editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()`
- Add/remover coluna: `addColumnAfter` / `deleteColumn`
- Add/remover linha: `addRowAfter` / `deleteRow`
- Mesclar/dividir células: `mergeOrSplit`
- Alternar linha de cabeçalho: `toggleHeaderRow`
- Excluir tabela: `deleteTable`

Esses controles só aparecem quando `editor.isActive('table')` (mesmo padrão condicional do toolbar de alinhamento da imagem). Extrair num componente `TableToolbar` para não estourar o tamanho do `TemplateEditor` (regra CLAUDE.md: componente < ~150 linhas).

### 4. CSS da tabela — **editor E PDF precisam casar**

A tabela é HTML nativo, então o puppeteer já a renderiza; o que falta é o **estilo** sobreviver ao export. O wrapper do PDF está em `document-template.service.ts` (~L187-198, bloco `<style>`). Adicionar ali regras de tabela e replicar as mesmas no editor (via `editorProps.attributes.style` não dá — usar classe/CSS global do editor no adm):

```css
table.doc-table { border-collapse: collapse; width: 100%; margin-bottom: 10px; table-layout: fixed; }
table.doc-table td, table.doc-table th { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
table.doc-table.no-border td, table.doc-table.no-border th { border: none; padding: 0 8px; }
```

> **Fonte única de verdade do CSS de impressão**: hoje o CSS do PDF vive embutido em `document-template.service.ts` e o editor reaproxima por conta própria. Esta story acopla os dois — registrar no commit que **qualquer regra nova de impressão deve ser espelhada nos dois lugares** até a Story 24 extrair um stylesheet compartilhado. Ver `[[24-editor-template-preview-a4]]`.

### 5. Multi-coluna (texto)

Atendido pela tabela `no-border` (2+ células numa linha = 2+ colunas de texto). Adicionar no botão de tabela uma opção rápida **"2 colunas"** que insere `insertTable({ rows: 1, cols: 2, withHeaderRow: false })` já com a classe `no-border` aplicada na tabela (via `updateAttributes('table', { class: 'doc-table no-border' })`).

> Alternativa CSS `column-count` foi descartada: puppeteer/`@media print` quebra colunas CSS de forma imprevisível entre páginas A4; tabela é determinística.

---

## Testes automatizados (Definition of Done)

| Arquivo | Caso |
| --- | --- |
| `apps/adm.fonte/e2e/document-templates.spec.ts` (Playwright; criar se não existir) | Abrir editor → inserir tabela 2×2 → digitar em 2 células → salvar → reabrir: tabela persiste no conteúdo (HTML contém `<table`) |
| idem | Inserir "2 colunas" (tabela no-border) → conteúdo salvo tem `class="doc-table no-border"` |
| `services/api/test/document-template.e2e-spec.ts` (se houver render de PDF testável) ou verificação manual | `GET /residents/:id/documents/:templateId/pdf` de um template com tabela retorna 200 e PDF não-vazio |

Rodar: `pnpm test:adm` (filtrando o spec). Sem `skip`/`only`.

## Verificação manual

1. `pnpm dev:adm` → editar template → inserir tabela, redimensionar coluna, mesclar células.
2. Inserir bloco "2 colunas", digitar texto nos dois lados.
3. Gerar o PDF de um filho com esse template → tabela e colunas aparecem com o mesmo layout do editor.

---

## Refinamentos pendentes (decisões)

1. **Estilo de borda padrão ao inserir**: tabela com borda visível (quadro de dados) ou sem borda (layout)? Proposta: botão principal = com borda; opção secundária "2 colunas" = sem borda.
2. **Cabeçalho**: inserir com linha de cabeçalho (`withHeaderRow`) por padrão? Proposta: não (documentos jurídicos raramente usam `<th>`).
3. **Colunas redimensionáveis no PDF**: o `resizable` salva larguras em `<colgroup>`; confirmar que o puppeteer respeita (provável sim). Se não, fixar `table-layout: fixed` + larguras percentuais.
