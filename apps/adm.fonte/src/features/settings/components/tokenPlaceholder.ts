import { Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// ─── createTokenPlaceholder (story 157) ───────────────────────────────────────
// Fábrica das CAIXAS ROTULADAS das variáveis de BLOCO do editor de template.
//
// No editor a variável aparece como o texto cru (`{{signature}}`,
// `{{residentPhoto}}`); no PDF ela vira um BLOCO que ocupa várias linhas
// (assinatura: imagem 64px + linha + nome; foto: quadrado de 151px — ver
// `.doc-signature*` / `.doc-photo*` em document-template.service.ts). Como o
// token cru ocupa só uma linha, a régua A4 do editor (story 24) mentiria sobre
// onde a página quebra — foi o bug que a story 141 consertou para a assinatura.
//
// A mecânica é sempre a mesma, então mora aqui uma vez só (extraída do
// `SignaturePlaceholder` monolítico na story 157): por ocorrência do token, uma
// `Decoration.inline(display:none)` esconde o texto cru e uma
// `Decoration.widget` desenha a caixa tracejada da ALTURA do bloco no PDF.
// Decorations são só de VIEW: o documento NÃO é alterado, então
// `editor.getHTML()` continua emitindo o token literal — contrato que o backend
// exige (stories 135/136/137/157).

export interface TokenPlaceholderConfig {
  // Token literal, com as chaves (ex.: `{{signature}}`).
  token: string;
  // Rótulo mostrado dentro da caixa.
  label: string;
  // Prefixo dos atributos DOM: `data-<dataKey>-placeholder` / `-token` /
  // `-remove`. Também compõe a `key` do widget.
  dataKey: string;
  // Nome da extensão TipTap (único por instância; vira também a PluginKey).
  name: string;
  // Geometria da caixa — espelha o CSS do bloco no PDF.
  widthPx: number;
  heightPx: number;
  marginTopPx: number;
  // Textos de interação (tooltip do clique e do botão ×).
  selectTitle: string;
  removeTitle: string;
}

export interface TokenPlaceholder {
  Extension: Extension;
  findRanges: (text: string | null | undefined) => Array<[number, number]>;
  buildDecorations: (doc: ProseMirrorNode, editor?: Editor) => DecorationSet;
}

export function createTokenPlaceholder(config: TokenPlaceholderConfig): TokenPlaceholder {
  const {
    token,
    label,
    dataKey,
    name,
    widthPx,
    heightPx,
    marginTopPx,
    selectTitle,
    removeTitle,
  } = config;

  // ─── findRanges (puro) ──────────────────────────────────────────────────────
  // Ranges [from, to) do token dentro de UMA string de texto. Função pura,
  // testável sem ProseMirror. 0/1/N ocorrências; texto sem o token (ou
  // vazio/nulo) → lista vazia.
  function findRanges(text: string | null | undefined): Array<[number, number]> {
    if (!text) return [];
    const ranges: Array<[number, number]> = [];
    let i = text.indexOf(token);
    while (i !== -1) {
      ranges.push([i, i + token.length]);
      i = text.indexOf(token, i + token.length);
    }
    return ranges;
  }

  // ─── Caixa (widget) ─────────────────────────────────────────────────────────
  // DOM da caixa rotulada. Estilo inline (sem depender de CSS externo). Não
  // editável internamente. Como o token cru fica `display:none` (ver decoration
  // abaixo), o cursor não o alcança pela seta/clique normal — a caixa precisava
  // dar um jeito de SELECIONAR e REMOVER a variável. Por isso:
  //   • clicar na caixa SELECIONA o range do token (fica destacado; Backspace/Del
  //     ou digitar por cima substitui);
  //   • o botão × REMOVE o token direto.
  // `editor`/`getPos` são opcionais: nos testes puros a caixa é montada sem eles
  // e vira só o rótulo estático.
  function buildPlaceholderBox(
    editor?: Editor,
    getPos?: () => number | undefined,
  ): HTMLElement {
    const box = document.createElement('span');
    box.setAttribute(`data-${dataKey}-placeholder`, 'true');
    box.setAttribute('contenteditable', 'false');
    Object.assign(box.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      boxSizing: 'border-box',
      width: `${widthPx}px`,
      maxWidth: '100%',
      height: `${heightPx}px`,
      marginTop: `${marginTopPx}px`,
      border: '1px dashed #94a3b8',
      borderRadius: '4px',
      color: '#64748b',
      fontSize: '11px',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      userSelect: 'none',
      verticalAlign: 'top',
    } satisfies Partial<CSSStyleDeclaration>);

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    box.appendChild(labelEl);

    // Interatividade só quando temos editor + posição (fora dos testes puros).
    if (editor && getPos) {
      box.style.cursor = 'pointer';
      box.title = selectTitle;

      // Range do token no doc: o widget é ancorado no início (side:1), então
      // getPos() é o `from`; o `to` soma o comprimento do token. getPos pode
      // devolver undefined se o widget saiu do doc — nesse caso não há o que fazer.
      const range = (): { from: number; to: number } | null => {
        const from = getPos();
        if (from == null) return null;
        return { from, to: from + token.length };
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
      remove.setAttribute(`data-${dataKey}-remove`, 'true');
      remove.textContent = '×';
      remove.title = removeTitle;
      remove.setAttribute('aria-label', removeTitle);
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

  // ─── buildDecorations ───────────────────────────────────────────────────────
  // Varre os nós de texto do doc atrás do token e monta, por ocorrência:
  //   1. uma inline decoration que ESCONDE o texto cru (`display:none`) — o token
  //      continua no documento (getHTML inalterado), só some da apresentação;
  //   2. um widget com a caixa rotulada renderizado no lugar.
  // O documento NÃO é alterado — decorations são só de view.
  function buildDecorations(doc: ProseMirrorNode, editor?: Editor): DecorationSet {
    const decorations: Decoration[] = [];
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      for (const [from, to] of findRanges(node.text)) {
        const start = pos + from;
        const end = pos + to;
        decorations.push(
          Decoration.inline(start, end, {
            style: 'display:none',
            [`data-${dataKey}-token`]: 'true',
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
              key: `${dataKey}-${start}`,
            },
          ),
        );
      }
    });
    return DecorationSet.create(doc, decorations);
  }

  const pluginKey = new PluginKey<DecorationSet>(name);

  const extension = Extension.create({
    name,
    addProseMirrorPlugins() {
      return [
        new Plugin<DecorationSet>({
          key: pluginKey,
          state: {
            init: (_config, state) => buildDecorations(state.doc, this.editor),
            // Só recalcula quando o doc muda (docChanged) — inserir/apagar o token
            // atualiza o placeholder; mudanças de seleção não custam nada.
            apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc, this.editor) : old),
          },
          props: {
            decorations(state) {
              return pluginKey.getState(state);
            },
          },
        }),
      ];
    },
  });

  return { Extension: extension, findRanges, buildDecorations };
}
