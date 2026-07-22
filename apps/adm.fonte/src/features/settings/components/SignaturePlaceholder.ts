import { Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// ─── SignaturePlaceholder (story 141) ─────────────────────────────────────────
// No editor de template a variável de assinatura aparece como o texto cru
// `{{signature}}`. Ao gerar o PDF esse token vira o BLOCO de assinatura (imagem
// ~64px + linha + nome — ver `.doc-signature` em document-template.service.ts),
// que ocupa várias linhas. Como o token cru ocupa só uma linha no editor, a
// paginação da folha A4 (story 24) não casa com a do PDF.
//
// Esta extensão renderiza — via DECORATION do ProseMirror, SEM alterar o
// documento — uma CAIXA ROTULADA "Assinatura" (retângulo tracejado) por cima de
// cada ocorrência do token, com ALTURA igual ao espaço do bloco no PDF. O texto
// `{{signature}}` literal PERMANECE no doc, então `editor.getHTML()` segue
// emitindo `<p …>{{signature}}</p>` — o que as stories 135/136/137 (detecção do
// parágrafo + substituição do token no backend) exigem. Só a APRESENTAÇÃO muda.

export const SIGNATURE_TOKEN = '{{signature}}';

// ─── Altura fiel ao bloco do PDF ──────────────────────────────────────────────
// Referência: CSS `.doc-signature` em
// services/api/src/modules/document-template/document-template.service.ts —
//   .doc-signature{margin-top:24px}
//   .doc-signature-img{height:64px}
//   .doc-signature-line + .doc-signature-name  → ~2 linhas de texto @12pt.
// Mantidas aqui como constantes próximas e comentadas: se a assinatura mudar de
// altura no PDF, sincronizar estes valores.
const SIGNATURE_MARGIN_TOP_PX = 24; // .doc-signature{margin-top:24px}
const SIGNATURE_IMG_HEIGHT_PX = 64; // .doc-signature-img{height:64px}
const SIGNATURE_TEXT_LINES_PX = 36; // linha (_____) + nome ≈ 2 linhas @12pt

// Altura da caixa (conteúdo). A margem-topo é aplicada separadamente para
// espelhar o `margin-top:24px` do bloco e preservar a paginação A4 (story 24).
export const SIGNATURE_PLACEHOLDER_HEIGHT_PX =
  SIGNATURE_IMG_HEIGHT_PX + SIGNATURE_TEXT_LINES_PX; // 100

// Largura da caixa. Espelha o `max-width:280px` da imagem da assinatura; como a
// caixa é inline-block, o `text-align` do parágrafo (story 136) a posiciona.
const SIGNATURE_PLACEHOLDER_WIDTH_PX = 260;

// ─── findSignatureRanges (puro) ───────────────────────────────────────────────
// Encontra os ranges [from, to) do token `{{signature}}` dentro de UMA string de
// texto. Função pura, testável sem ProseMirror. 0/1/N ocorrências; texto sem o
// token (ou vazio/nulo) → lista vazia.
export function findSignatureRanges(
  text: string | null | undefined,
): Array<[number, number]> {
  if (!text) return [];
  const ranges: Array<[number, number]> = [];
  let i = text.indexOf(SIGNATURE_TOKEN);
  while (i !== -1) {
    ranges.push([i, i + SIGNATURE_TOKEN.length]);
    i = text.indexOf(SIGNATURE_TOKEN, i + SIGNATURE_TOKEN.length);
  }
  return ranges;
}

// ─── Caixa (widget) ───────────────────────────────────────────────────────────
// DOM da caixa rotulada. Estilo inline (sem depender de CSS externo). Não
// editável internamente. Como o token cru fica `display:none` (ver decoration
// abaixo), o cursor não o alcança pela seta/clique normal — a caixa precisava
// dar um jeito de SELECIONAR e REMOVER a variável. Por isso:
//   • clicar na caixa SELECIONA o range do token (fica destacado; Backspace/Del
//     ou digitar por cima substitui);
//   • o botão × REMOVE o token direto.
// `editor`/`getPos` são opcionais: nos testes puros a caixa é montada sem eles e
// vira só o rótulo estático (comportamento antigo).
function buildPlaceholderBox(
  editor?: Editor,
  getPos?: () => number | undefined,
): HTMLElement {
  const box = document.createElement('span');
  box.setAttribute('data-signature-placeholder', 'true');
  box.setAttribute('contenteditable', 'false');
  Object.assign(box.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxSizing: 'border-box',
    width: `${SIGNATURE_PLACEHOLDER_WIDTH_PX}px`,
    maxWidth: '100%',
    height: `${SIGNATURE_PLACEHOLDER_HEIGHT_PX}px`,
    marginTop: `${SIGNATURE_MARGIN_TOP_PX}px`,
    border: '1px dashed #94a3b8',
    borderRadius: '4px',
    color: '#64748b',
    fontSize: '11px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    userSelect: 'none',
    verticalAlign: 'top',
  } satisfies Partial<CSSStyleDeclaration>);

  const label = document.createElement('span');
  label.textContent = 'Assinatura';
  box.appendChild(label);

  // Interatividade só quando temos editor + posição (fora dos testes puros).
  if (editor && getPos) {
    box.style.cursor = 'pointer';
    box.title = 'Clique para selecionar a variável de assinatura';

    // Range do token no doc: o widget é ancorado no início (side:1), então
    // getPos() é o `from`; o `to` soma o comprimento do token. getPos pode
    // devolver undefined se o widget saiu do doc — nesse caso não há o que fazer.
    const range = (): { from: number; to: number } | null => {
      const from = getPos();
      if (from == null) return null;
      return { from, to: from + SIGNATURE_TOKEN.length };
    };

    // Clicar na caixa seleciona o token (destaque visível + apagável no teclado).
    // stopPropagation: sem isto o mousedown chega ao handler do ProseMirror, que
    // recolocaria a seleção pela coordenada do clique (sobre o token oculto) e
    // desfaria a nossa seleção programática.
    box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = range();
      if (r) editor.chain().focus().setTextSelection(r).run();
    });

    // Botão × — remove a variável.
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('data-signature-remove', 'true');
    remove.textContent = '×';
    remove.title = 'Remover assinatura';
    remove.setAttribute('aria-label', 'Remover assinatura');
    Object.assign(remove.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '18px',
      height: '18px',
      padding: '0',
      lineHeight: '1',
      fontSize: '14px',
      border: '1px solid #cbd5e1',
      borderRadius: '4px',
      background: '#fff',
      color: '#64748b',
      cursor: 'pointer',
    } satisfies Partial<CSSStyleDeclaration>);
    remove.addEventListener('mousedown', (e) => {
      // Não deixa o mousedown da caixa (selecionar) rodar junto.
      e.preventDefault();
      e.stopPropagation();
      const r = range();
      if (r) editor.chain().focus().deleteRange(r).run();
    });
    box.appendChild(remove);
  }

  return box;
}

// ─── buildSignatureDecorations ────────────────────────────────────────────────
// Varre os nós de texto do doc atrás do token e monta, por ocorrência:
//   1. uma inline decoration que ESCONDE o texto cru (`display:none`) — o token
//      continua no documento (getHTML inalterado), só some da apresentação;
//   2. um widget com a caixa rotulada renderizado no lugar.
// O documento NÃO é alterado — decorations são só de view.
export function buildSignatureDecorations(
  doc: ProseMirrorNode,
  editor?: Editor,
): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const [from, to] of findSignatureRanges(node.text)) {
      const start = pos + from;
      const end = pos + to;
      decorations.push(
        Decoration.inline(start, end, {
          style: 'display:none',
          'data-signature-token': 'true',
        }),
      );
      decorations.push(
        Decoration.widget(
          start,
          // toDOM recebe (view, getPos): passamos editor + getPos p/ a caixa
          // poder selecionar/remover o token (getPos reflete a posição atual,
          // válida mesmo após edições anteriores no doc).
          (_view: EditorView, getPos: () => number | undefined) =>
            buildPlaceholderBox(editor, getPos),
          {
            side: 1,
            key: `signature-${start}`,
          },
        ),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

const signaturePlaceholderKey = new PluginKey<DecorationSet>('signaturePlaceholder');

export const SignaturePlaceholder = Extension.create({
  name: 'signaturePlaceholder',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: signaturePlaceholderKey,
        state: {
          init: (_config, state) => buildSignatureDecorations(state.doc, this.editor),
          // Só recalcula quando o doc muda (docChanged) — inserir/apagar o token
          // atualiza o placeholder; mudanças de seleção não custam nada.
          apply: (tr, old) =>
            tr.docChanged ? buildSignatureDecorations(tr.doc, this.editor) : old,
        },
        props: {
          decorations(state) {
            return signaturePlaceholderKey.getState(state);
          },
        },
      }),
    ];
  },
});
