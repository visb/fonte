import { parseInline, parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('separa títulos, listas e parágrafos', () => {
    const blocks = parseMarkdown(
      '## Ops (celular)\n- um\n* dois\n\nParágrafo\ncontinuado\n### Detalhe\nTexto\n- item',
    );
    expect(blocks).toEqual([
      { kind: 'heading', level: 2, text: 'Ops (celular)' },
      { kind: 'list', items: ['um', 'dois'] },
      { kind: 'paragraph', text: 'Parágrafo continuado' },
      { kind: 'heading', level: 3, text: 'Detalhe' },
      { kind: 'paragraph', text: 'Texto' },
      { kind: 'list', items: ['item'] },
    ]);
  });

  it('lista seguida de parágrafo sem linha em branco fecha a lista', () => {
    expect(parseMarkdown('- a\ntexto')).toEqual([
      { kind: 'list', items: ['a'] },
      { kind: 'paragraph', text: 'texto' },
    ]);
  });

  it('normaliza CRLF e ignora linhas vazias', () => {
    expect(parseMarkdown('\r\n## T\r\n\r\n')).toEqual([{ kind: 'heading', level: 2, text: 'T' }]);
  });

  it('texto vazio não gera bloco', () => {
    expect(parseMarkdown('')).toEqual([]);
  });
});

describe('parseInline', () => {
  it('reconhece negrito e código', () => {
    expect(parseInline('abra **Pendências** e rode `x`')).toEqual([
      { kind: 'text', text: 'abra ' },
      { kind: 'strong', text: 'Pendências' },
      { kind: 'text', text: ' e rode ' },
      { kind: 'code', text: 'x' },
    ]);
  });

  it('texto sem marcação volta inteiro', () => {
    expect(parseInline('simples')).toEqual([{ kind: 'text', text: 'simples' }]);
  });
});
