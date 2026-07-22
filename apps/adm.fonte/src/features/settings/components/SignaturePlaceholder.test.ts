import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  SignaturePlaceholder,
  SIGNATURE_TOKEN,
  SIGNATURE_PLACEHOLDER_HEIGHT_PX,
  findSignatureRanges,
} from './SignaturePlaceholder';

// ─── findSignatureRanges (puro) ───────────────────────────────────────────────

describe('findSignatureRanges', () => {
  it('texto sem o token → vazio', () => {
    expect(findSignatureRanges('Olá mundo')).toEqual([]);
    expect(findSignatureRanges('{signature}')).toEqual([]);
    expect(findSignatureRanges('{{name}}')).toEqual([]);
  });

  it('string vazia / nula / indefinida → vazio', () => {
    expect(findSignatureRanges('')).toEqual([]);
    expect(findSignatureRanges(null)).toEqual([]);
    expect(findSignatureRanges(undefined)).toEqual([]);
  });

  it('1 ocorrência → o range correto do token', () => {
    const text = `Assine aqui: ${SIGNATURE_TOKEN}.`;
    const from = text.indexOf(SIGNATURE_TOKEN);
    expect(findSignatureRanges(text)).toEqual([[from, from + SIGNATURE_TOKEN.length]]);
  });

  it('token no início da string → range a partir de 0', () => {
    expect(findSignatureRanges(SIGNATURE_TOKEN)).toEqual([[0, SIGNATURE_TOKEN.length]]);
  });

  it('N ocorrências → todos os ranges, sem sobreposição', () => {
    const text = `${SIGNATURE_TOKEN} e depois ${SIGNATURE_TOKEN} fim ${SIGNATURE_TOKEN}`;
    const ranges = findSignatureRanges(text);
    expect(ranges).toHaveLength(3);
    // Cada range recorta exatamente o token.
    for (const [from, to] of ranges) {
      expect(text.slice(from, to)).toBe(SIGNATURE_TOKEN);
    }
    // Ordenados e disjuntos.
    expect(ranges[0][1]).toBeLessThanOrEqual(ranges[1][0]);
    expect(ranges[1][1]).toBeLessThanOrEqual(ranges[2][0]);
  });
});

// ─── Editor real + extensão ───────────────────────────────────────────────────
// Monta um Editor TipTap real (jsdom) com StarterKit + a extensão e verifica que:
//  - a decoration/caixa é aplicada no range do token;
//  - o documento NÃO é alterado → getHTML segue com `{{signature}}` literal
//    (guarda contra quebrar backend 135/136/137);
//  - conteúdo sem token → nenhuma caixa;
//  - inserir o token (clique 139 / drag-drop 140 inserem o mesmo token) faz a
//    caixa aparecer; apagar o token a remove.

const editors: Editor[] = [];

function makeEditor(content: string): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [StarterKit, SignaturePlaceholder],
    content,
  });
  editors.push(editor);
  return editor;
}

function placeholderEl(editor: Editor): HTMLElement | null {
  return editor.view.dom.querySelector('[data-signature-placeholder]');
}

function removeBtn(editor: Editor): HTMLButtonElement | null {
  return editor.view.dom.querySelector('[data-signature-remove]');
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
  document.body.innerHTML = '';
});

describe('SignaturePlaceholder — decoration no editor', () => {
  it('conteúdo com o token → caixa "Assinatura" com a altura do bloco do PDF', () => {
    const editor = makeEditor(`<p>${SIGNATURE_TOKEN}</p>`);
    const box = placeholderEl(editor);
    expect(box).not.toBeNull();
    // Rótulo "Assinatura" + botão de remover convivem na caixa.
    expect(box?.textContent).toContain('Assinatura');
    expect(box?.style.height).toBe(`${SIGNATURE_PLACEHOLDER_HEIGHT_PX}px`);
    // Não editável internamente.
    expect(box?.getAttribute('contenteditable')).toBe('false');
  });

  it('caixa expõe botão × para remover a variável de assinatura', () => {
    const editor = makeEditor(`<p>Assine: ${SIGNATURE_TOKEN}</p>`);
    expect(removeBtn(editor)).not.toBeNull();
  });

  it('clicar no × remove o token e a caixa (getHTML sem {{signature}})', () => {
    const editor = makeEditor(`<p>Assine: ${SIGNATURE_TOKEN} fim</p>`);
    const btn = removeBtn(editor);
    expect(btn).not.toBeNull();
    btn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(placeholderEl(editor)).toBeNull();
    expect(editor.getHTML()).not.toContain(SIGNATURE_TOKEN);
    // Só o token some — o texto ao redor permanece.
    expect(editor.getHTML()).toContain('Assine:');
    expect(editor.getHTML()).toContain('fim');
  });

  it('clicar na caixa seleciona o range do token', () => {
    const editor = makeEditor(`<p>${SIGNATURE_TOKEN}</p>`);
    const box = placeholderEl(editor);
    box?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe(SIGNATURE_TOKEN);
  });

  it('getHTML() AINDA contém {{signature}} literal (não quebra backend 135/136/137)', () => {
    const editor = makeEditor(`<p>${SIGNATURE_TOKEN}</p>`);
    expect(editor.getHTML()).toContain(SIGNATURE_TOKEN);
  });

  it('conteúdo sem o token → nenhuma caixa', () => {
    const editor = makeEditor('<p>Sem assinatura aqui</p>');
    expect(placeholderEl(editor)).toBeNull();
    expect(editor.getHTML()).not.toContain(SIGNATURE_TOKEN);
  });

  it('N ocorrências → uma caixa por token', () => {
    const editor = makeEditor(`<p>${SIGNATURE_TOKEN}</p><p>${SIGNATURE_TOKEN}</p>`);
    expect(editor.view.dom.querySelectorAll('[data-signature-placeholder]')).toHaveLength(2);
  });

  it('regressão 139/140: inserir o token via comando faz a caixa aparecer', () => {
    const editor = makeEditor('<p></p>');
    expect(placeholderEl(editor)).toBeNull();
    // Clique (139) e drag-drop (140) inserem exatamente o texto `{{signature}}`.
    editor.chain().focus().insertContent(SIGNATURE_TOKEN).run();
    expect(placeholderEl(editor)).not.toBeNull();
    expect(editor.getHTML()).toContain(SIGNATURE_TOKEN);
  });

  it('apagar o token remove a caixa', () => {
    const editor = makeEditor(`<p>${SIGNATURE_TOKEN}</p>`);
    expect(placeholderEl(editor)).not.toBeNull();
    editor.commands.setContent('<p></p>');
    expect(placeholderEl(editor)).toBeNull();
    expect(editor.getHTML()).not.toContain(SIGNATURE_TOKEN);
  });
});
