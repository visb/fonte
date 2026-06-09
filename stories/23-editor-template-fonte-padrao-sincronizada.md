# Plan: Sincronizar a fonte padrão do editor com os botões A+/A−

## Context

No editor de templates (`TemplateEditor.tsx`), o tamanho da fonte tem **duas referências desalinhadas**:

- **Base do editor** (texto sem marca): `editorProps.attributes.style = '... font-size: 10px ...'` (L384) — em **px**.
- **Base do PDF** (mesmo texto na impressão): `body{font-size:10px}` em `document-template.service.ts` (L189) — em **px**.
- **Controle A+/A−** (`changeFontSize`, L461-467): quando não há marca `fontSize` ativa, assume `currentPt = 12` — em **pt** — e aplica passo de ±2pt.

Consequências do desalinhamento **px×pt** e **10×12**:
- O texto inicial renderiza a `10px` (≈ 7,5pt), mas o controle "acha" que está a `12pt`.
- Ao clicar **A−** uma vez sobre texto sem marca: parte de `12pt` (não do real `10px`) → grava `10pt` (≈ 13,3px) → o tamanho **salta** em vez de variar 1 passo a partir do que se vê.
- Não existe relação "**−1 e depois +1 volta ao inicial**", porque o "inicial" (base px) não corresponde a nenhum degrau da escala pt do controle.

Requisito do usuário: a fonte deve **começar no mesmo tamanho** que o controle considera padrão; clicar **A−** 1× e **A+** 1× deve voltar exatamente ao tamanho inicial.

---

## Implementação

### 1. Constante única de fonte padrão — `TemplateEditor.tsx`

```ts
const DEFAULT_FONT_PT = 12;     // tamanho-base do corpo do documento (pt) — DECISÃO
const FONT_STEP_PT    = 2;      // passo do A+/A− — DECISÃO
const MIN_FONT_PT = 8, MAX_FONT_PT = 72;
```

### 2. Base do editor em **pt**, igual à do controle

Trocar o `font-size: 10px` do `editorProps.attributes.style` por `font-size: ${DEFAULT_FONT_PT}pt`. Assim o texto sem marca renderiza no **mesmo valor e unidade** que o controle usa como default.

### 3. `changeFontSize` lê o default da constante (não hardcode 12)

```ts
const changeFontSize = (delta: number) => {
  if (!editor) return;
  const attrs = editor.getAttributes('fontSize');
  const currentPt = attrs.pt ? Number(attrs.pt) : DEFAULT_FONT_PT;   // era 12
  const next = Math.max(MIN_FONT_PT, Math.min(MAX_FONT_PT, currentPt + delta));
  editor.chain().focus().setMark('fontSize', { pt: next, lh: attrs.lh ?? null }).run();
};
```

E os botões passam a usar o passo nomeado:

```tsx
<ToolbarButton ... onClick={() => changeFontSize(FONT_STEP_PT)}  title="Aumentar fonte">A+</ToolbarButton>
<ToolbarButton ... onClick={() => changeFontSize(-FONT_STEP_PT)} title="Diminuir fonte">A−</ToolbarButton>
```

Com isso, sobre texto no default: A− → `DEFAULT−1`; A+ → `DEFAULT` de volta. Simétrico.

### 4. Base do PDF em **pt**, sincronizada — `document-template.service.ts`

Trocar `body{font-size:10px}` por `body{font-size:12pt}` (= `DEFAULT_FONT_PT`) para o **editor casar 1:1 com a impressão**. Como hoje é `10px` e passa a `12pt` (= 16px), o texto-base **cresce ~60%** na impressão — decisão tomada (padrão "documento" 12pt); **revisar os templates já cadastrados** após o deploy (ver §Refinamentos #3).

> A unificação px→pt é também pré-requisito para a pré-visualização A4 fiel da `[[24-editor-template-preview-a4]]` (preview tem que bater com o PDF).

### 5. (Opcional) Refletir o tamanho atual no toolbar

Mostrar o valor pt corrente entre os botões A−/A+ (lê `editor.getAttributes('fontSize').pt ?? DEFAULT_FONT_PT`), para o usuário ver em que degrau está. Pequeno, mas remove a ambiguidade que gerou o bug.

---

## Testes automatizados (Definition of Done)

> `changeFontSize` é um closure sobre o editor TipTap; testar via e2e do adm (estado do DOM) é o caminho mais direto. Se for extraído como função pura `nextFontPt(current, delta, default)`, cobrir com unit test.

| Arquivo | Caso |
| --- | --- |
| `apps/adm.fonte/src/features/settings/.../fontSize.spec.ts` (se extrair `nextFontPt` puro) | `nextFontPt(undefined,-1)=DEFAULT-1`; `nextFontPt(DEFAULT-1,+1)=DEFAULT`; clamp em MIN/MAX |
| `apps/adm.fonte/e2e/document-templates.spec.ts` | Selecionar texto base → A− 1× → A+ 1× → `font-size` da marca volta ao valor inicial (sem salto) |

Rodar: `pnpm test:adm`.

## Verificação manual

1. `pnpm dev:adm` → editar template → o texto inicial está no tamanho `DEFAULT_FONT_PT`.
2. Selecionar texto → A− 1× (diminui 1 passo) → A+ 1× → volta ao tamanho inicial idêntico.
3. Gerar PDF → tamanho do corpo bate com o que se vê no editor.

---

## Refinamentos pendentes (decisões)

1. ✅ **`DEFAULT_FONT_PT` = 12pt** (padrão documento). Decidido.
2. ✅ **`FONT_STEP_PT` = 2pt**. Decidido.
3. ⚠️ **Migração dos templates existentes**: a base muda de `10px` para `12pt` (~+60% no corpo sem marca). Não há migration de dados (é HTML salvo); após o deploy, **listar e reabrir cada template existente** conferindo a impressão e ajustando onde quebrar. Incluir esse passo na verificação manual antes de fechar a story.
