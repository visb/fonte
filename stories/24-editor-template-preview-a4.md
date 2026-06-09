# Plan: Pré-visualização real do template em folha A4

## Context

Ao editar um template (`TemplateEditor.tsx`), o usuário **não vê** como o texto fica posicionado na folha impressa. O editor apenas **aproxima** a área de conteúdo com `max-width: 720px` (comentário "simula área A4"), mas:
- Não respeita as **proporções reais** da A4 (210×297mm).
- Não mostra as **margens** reais do PDF (40px em todos os lados + `padding:48px 40px` do `body`).
- Não mostra **quebras de página** (onde o conteúdo passa para a 2ª folha).
- A unidade de fonte do editor (px) hoje difere da do PDF — ver `[[23-editor-template-fonte-padrao-sincronizada]]`.

O PDF real é gerado por puppeteer em `document-template.service.ts`: `page.pdf({ format: 'A4', margin: 40px })` sobre o HTML de `renderForResident`, cujo `<style>` define `body{font-family:Arial;font-size:10px;line-height:1.2;max-width:800px;padding:48px 40px}`.

Requisito: "ao editar um template, preciso ter uma visão real do texto posicionado na hora da impressão numa folha A4."

---

## Implementação

### 1. CSS de impressão como fonte única de verdade

Hoje o CSS de impressão vive embutido no template HTML de `document-template.service.ts` e o editor reaproxima por conta própria. Extrair as regras de corpo/tipografia/tabela para uma **constante compartilhada** consumível pelos dois lados:

- Opção A (preferida): mover a string de CSS para `packages/types` (ou um novo `packages/doc-styles`) exportando `DOCUMENT_PRINT_CSS`. Backend injeta no `<style>`; frontend injeta no preview. Garante 1:1.
- Opção B (mínimo): duplicar o CSS no frontend e marcar no código que **as duas cópias devem andar juntas** (mais frágil).

Recomendo A — é o que torna o preview confiável a longo prazo.

### 2. Componente `A4Preview` — `features/settings/components/A4Preview.tsx`

Renderiza `editor.getHTML()` dentro de uma "página" com proporção A4 real e as margens do PDF:

```tsx
// página A4: 210mm × 297mm; margens do PDF = 40px ~ 30px de padding interno equiv.
<div className="a4-page" style={{
  width: '210mm', minHeight: '297mm',
  padding: '48px 40px',                 // == body do PDF
  background: '#fff', boxShadow: '0 0 0 1px #ddd, 0 8px 24px rgba(0,0,0,.12)',
  fontFamily: 'Arial, Helvetica, sans-serif',
}}>
  <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
</div>
```

- Aplicar `DOCUMENT_PRINT_CSS` num `<style scoped>`/classe que envolve o preview, para tabela/listas/imagem baterem com o PDF.
- **Escala**: 210mm não cabe em telas estreitas; envolver num container com `transform: scale(...)` calculado pela largura disponível (ou `zoom`), mantendo as proporções. Mostrar a régua de zoom (50/75/100%).

### 3. Variáveis no preview

O template tem placeholders `{{name}}`, `{{cpf}}`, etc. (lista em `VARIABLES`). No preview (sem filho selecionado), renderizar os placeholders de forma legível:
- Opção A: substituir por **rótulos** entre colchetes (ex.: `[Nome completo]`) — deixa claro que é variável.
- Opção B: substituir por **dados de exemplo** fixos.
Proposta: A (rótulos), reusando o mapa `VARIABLES`.

### 4. Paginação (quebras de página A4)

Mostrar onde o conteúdo passa de página. Abordagens:
- **MVP**: uma única página A4 de largura/margens reais com **guias horizontais tracejadas** a cada altura de página (297mm − margens) indicando a quebra. Simples e suficiente para "ver o posicionamento".
- **Completo**: paginar de verdade, fatiando o conteúdo em N folhas A4 empilhadas (mais complexo; mede a altura renderizada e quebra). Considerar lib só se o MVP não bastar.
Proposta: começar pelo MVP (guias de quebra), evoluir depois.

### 5. Integração na UI — `TemplateEditor.tsx`

Botão **"Pré-visualizar (A4)"** no toolbar abrindo o `A4Preview`:
- Modo **toggle lado a lado** (editor à esquerda, preview à direita) em telas largas, ou
- Modo **modal/drawer** de preview em telas estreitas.
Proposta: toggle lado a lado com fallback modal. Atualiza ao vivo de `editor.getHTML()` (ou em um "atualizar preview" para não re-renderizar a cada tecla).

---

## Testes automatizados (Definition of Done)

| Arquivo | Caso |
| --- | --- |
| `apps/adm.fonte/e2e/document-templates.spec.ts` | Abrir editor → clicar "Pré-visualizar (A4)" → `.a4-page` visível com width A4; conteúdo do editor aparece dentro |
| idem | Placeholder `{{name}}` no conteúdo → preview mostra `[Nome completo]` (rótulo), não o literal `{{name}}` |
| Visual/manual | Texto do preview alinhado com a saída do PDF (mesmas margens/fonte) |

Rodar: `pnpm test:adm`.

## Verificação manual

1. `pnpm dev:adm` → editar template → "Pré-visualizar (A4)": página com proporção/margens reais.
2. Encher de texto até passar de uma página → guia de quebra aparece na posição correta.
3. Gerar o PDF real de um filho → posicionamento bate com o preview (mesma fonte/margem/tabela).

---

## Refinamentos pendentes (decisões)

1. **Fonte do CSS**: extrair `DOCUMENT_PRINT_CSS` para pacote compartilhado [proposta A] ou duplicar no frontend [B]? A é mais robusto; B é mais rápido.
2. **Layout do preview**: lado a lado (live) vs modal sob demanda. Proposta: lado a lado com botão "atualizar" para não re-renderizar a cada tecla.
3. **Paginação**: guias de quebra (MVP) vs folhas paginadas de verdade. Proposta: MVP primeiro.
4. **Variáveis no preview**: rótulos `[Nome completo]` vs dados de exemplo. Proposta: rótulos.
5. **Dependência da Story 23**: o preview só é fiel se a unidade de fonte editor/PDF estiver unificada — fazer **depois** da `[[23-editor-template-fonte-padrao-sincronizada]]`.
