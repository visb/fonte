import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  ResidentPhotoPlaceholder,
  RESIDENT_PHOTO_TOKEN,
  RESIDENT_PHOTO_PLACEHOLDER_SIZE_PX,
  findResidentPhotoRanges,
} from './ResidentPhotoPlaceholder';
import { SignaturePlaceholder, SIGNATURE_TOKEN } from './SignaturePlaceholder';

// ─── findResidentPhotoRanges (puro) ───────────────────────────────────────────

describe('findResidentPhotoRanges', () => {
  it('texto sem o token → vazio', () => {
    expect(findResidentPhotoRanges('Olá mundo')).toEqual([]);
    expect(findResidentPhotoRanges('{residentPhoto}')).toEqual([]);
    // não confunde com a outra variável de bloco nem com o campo de texto
    expect(findResidentPhotoRanges('{{signature}}')).toEqual([]);
    expect(findResidentPhotoRanges('{{name}}')).toEqual([]);
  });

  it('string vazia / nula / indefinida → vazio', () => {
    expect(findResidentPhotoRanges('')).toEqual([]);
    expect(findResidentPhotoRanges(null)).toEqual([]);
    expect(findResidentPhotoRanges(undefined)).toEqual([]);
  });

  it('1 ocorrência → o range correto do token', () => {
    const text = `Foto: ${RESIDENT_PHOTO_TOKEN}.`;
    const from = text.indexOf(RESIDENT_PHOTO_TOKEN);
    expect(findResidentPhotoRanges(text)).toEqual([[from, from + RESIDENT_PHOTO_TOKEN.length]]);
  });

  it('N ocorrências → todos os ranges, sem sobreposição', () => {
    const text = `${RESIDENT_PHOTO_TOKEN} e ${RESIDENT_PHOTO_TOKEN} fim ${RESIDENT_PHOTO_TOKEN}`;
    const ranges = findResidentPhotoRanges(text);
    expect(ranges).toHaveLength(3);
    for (const [from, to] of ranges) {
      expect(text.slice(from, to)).toBe(RESIDENT_PHOTO_TOKEN);
    }
    expect(ranges[0][1]).toBeLessThanOrEqual(ranges[1][0]);
    expect(ranges[1][1]).toBeLessThanOrEqual(ranges[2][0]);
  });
});

// ─── Editor real + extensão ───────────────────────────────────────────────────
// Espelha SignaturePlaceholder.test.ts: Editor TipTap real (jsdom) com StarterKit
// + a extensão. O que importa é que a caixa apareça com o TAMANHO do bloco do PDF
// e que o DOCUMENTO siga intocado — `getHTML()` continua emitindo o token
// literal, que é o contrato com o backend (story 157).

const editors: Editor[] = [];

function makeEditor(content: string, extensions = [StarterKit, ResidentPhotoPlaceholder]): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({ element, extensions, content });
  editors.push(editor);
  return editor;
}

function placeholderEl(editor: Editor): HTMLElement | null {
  return editor.view.dom.querySelector('[data-resident-photo-placeholder]');
}

function removeBtn(editor: Editor): HTMLButtonElement | null {
  return editor.view.dom.querySelector('[data-resident-photo-remove]');
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
  document.body.innerHTML = '';
});

describe('ResidentPhotoPlaceholder — decoration no editor', () => {
  it('conteúdo com o token → caixa "Foto do acolhido" de 151×151 (o quadrado do PDF)', () => {
    const editor = makeEditor(`<p>${RESIDENT_PHOTO_TOKEN}</p>`);
    const box = placeholderEl(editor);
    expect(box).not.toBeNull();
    expect(box?.textContent).toContain('Foto do acolhido');
    expect(box?.style.width).toBe(`${RESIDENT_PHOTO_PLACEHOLDER_SIZE_PX}px`);
    expect(box?.style.height).toBe(`${RESIDENT_PHOTO_PLACEHOLDER_SIZE_PX}px`);
    expect(RESIDENT_PHOTO_PLACEHOLDER_SIZE_PX).toBe(151); // = .doc-photo-img no backend
    expect(box?.getAttribute('contenteditable')).toBe('false');
  });

  it('clicar no × remove o token e a caixa (getHTML sem {{residentPhoto}})', () => {
    const editor = makeEditor(`<p>Foto: ${RESIDENT_PHOTO_TOKEN} fim</p>`);
    const btn = removeBtn(editor);
    expect(btn).not.toBeNull();
    btn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(placeholderEl(editor)).toBeNull();
    expect(editor.getHTML()).not.toContain(RESIDENT_PHOTO_TOKEN);
    // Só o token some — o texto ao redor permanece.
    expect(editor.getHTML()).toContain('Foto:');
    expect(editor.getHTML()).toContain('fim');
  });

  it('clicar na caixa seleciona o range do token', () => {
    const editor = makeEditor(`<p>${RESIDENT_PHOTO_TOKEN}</p>`);
    placeholderEl(editor)?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe(RESIDENT_PHOTO_TOKEN);
  });

  it('getHTML() AINDA contém {{residentPhoto}} literal (contrato com o backend)', () => {
    const editor = makeEditor(`<p>${RESIDENT_PHOTO_TOKEN}</p>`);
    expect(editor.getHTML()).toContain(RESIDENT_PHOTO_TOKEN);
  });

  it('conteúdo sem o token → nenhuma caixa', () => {
    const editor = makeEditor('<p>Sem foto aqui</p>');
    expect(placeholderEl(editor)).toBeNull();
  });

  it('N ocorrências → uma caixa por token', () => {
    const editor = makeEditor(`<p>${RESIDENT_PHOTO_TOKEN}</p><p>${RESIDENT_PHOTO_TOKEN}</p>`);
    expect(editor.view.dom.querySelectorAll('[data-resident-photo-placeholder]')).toHaveLength(2);
  });

  it('regressão 139/140: inserir o token via comando faz a caixa aparecer', () => {
    const editor = makeEditor('<p></p>');
    expect(placeholderEl(editor)).toBeNull();
    editor.chain().focus().insertContent(RESIDENT_PHOTO_TOKEN).run();
    expect(placeholderEl(editor)).not.toBeNull();
    expect(editor.getHTML()).toContain(RESIDENT_PHOTO_TOKEN);
  });

  it('apagar o token remove a caixa', () => {
    const editor = makeEditor(`<p>${RESIDENT_PHOTO_TOKEN}</p>`);
    expect(placeholderEl(editor)).not.toBeNull();
    editor.commands.setContent('<p></p>');
    expect(placeholderEl(editor)).toBeNull();
  });

  // As duas extensões saem da MESMA fábrica: rodando juntas (como no
  // TemplateEditor real) cada uma decora só o seu token, sem sequestrar o do
  // outro nem colidir no plugin state.
  it('convive com o SignaturePlaceholder: cada caixa no seu token', () => {
    const editor = makeEditor(
      `<p>${RESIDENT_PHOTO_TOKEN}</p><p>${SIGNATURE_TOKEN}</p>`,
      [StarterKit, SignaturePlaceholder, ResidentPhotoPlaceholder],
    );

    expect(editor.view.dom.querySelectorAll('[data-resident-photo-placeholder]')).toHaveLength(1);
    expect(editor.view.dom.querySelectorAll('[data-signature-placeholder]')).toHaveLength(1);
    const html = editor.getHTML();
    expect(html).toContain(RESIDENT_PHOTO_TOKEN);
    expect(html).toContain(SIGNATURE_TOKEN);
  });
});
