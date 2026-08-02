import { describe, expect, it } from 'vitest';
import {
  A4_CONTENT_HEIGHT_PX,
  A4_CONTENT_WIDTH_PX,
  A4_MARGIN_TOP_PX,
  A4_MARGIN_X_PX,
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
  DOCUMENT_PRINT_CSS,
  EDITOR_PAGE_CSS,
} from '@fonte/doc-styles';

// Story 154 — contrato do CSS compartilhado (@fonte/doc-styles), testado do lado
// do editor porque é ele o outro consumidor do pacote: se a geometria mudar aqui
// sem a contrapartida no PDF (ou vice-versa), a quebra na tela deixa de casar com
// a do papel. A margem do documento saiu do `padding` do body — caixa do FLUXO,
// que só materializa no topo da 1ª página e no pé da última — e virou margem da
// PÁGINA (`@page`), que se repete em todas.
describe('@fonte/doc-styles — margem na caixa da página (story 154)', () => {
  // Extrai o bloco de declarações de um seletor do CSS compactado.
  function ruleBody(css: string, selector: string): string {
    const match = new RegExp(`${selector.replace('.', '\\.')}\\{([^}]*)\\}`).exec(css);
    if (!match) throw new Error(`regra "${selector}" não encontrada no CSS`);
    return match[1];
  }

  it('DOCUMENT_PRINT_CSS declara @page A4 com a margem 48px 40px', () => {
    expect(DOCUMENT_PRINT_CSS).toContain('@page{size:A4;margin:48px 40px}');
    expect(DOCUMENT_PRINT_CSS).toContain(
      `@page{size:A4;margin:${A4_MARGIN_TOP_PX}px ${A4_MARGIN_X_PX}px}`,
    );
  });

  it('o body do PDF não carrega mais padding nem a largura fixa da folha', () => {
    const body = ruleBody(DOCUMENT_PRINT_CSS, 'body');
    // O padding era a margem antiga; mantê-lo somaria à margem da página.
    expect(body).not.toContain('padding:');
    // 794px transbordaria a área imprimível deixada pela margem (714px).
    expect(body).not.toContain(`width:${A4_PAGE_WIDTH_PX}px`);
    expect(body).toContain('width:100%');
  });

  it('a caixa de conteúdo é a página menos as duas margens (714 × 1027)', () => {
    expect(A4_CONTENT_HEIGHT_PX).toBe(A4_PAGE_HEIGHT_PX - 2 * A4_MARGIN_TOP_PX);
    expect(A4_CONTENT_WIDTH_PX).toBe(A4_PAGE_WIDTH_PX - 2 * A4_MARGIN_X_PX);
    expect(A4_CONTENT_HEIGHT_PX).toBe(1027);
    expect(A4_CONTENT_WIDTH_PX).toBe(714);
  });

  // Decisão 2/5 da story: os valores da margem não mudaram e o editor NÃO
  // regrediu — a folha na tela continua 794px com padding 48/40, o que reserva
  // exatamente a mesma caixa de conteúdo do papel.
  it('EDITOR_PAGE_CSS segue com a folha 794px e o padding 48px 40px', () => {
    const page = ruleBody(EDITOR_PAGE_CSS, '.a4-page');
    expect(page).toContain(`width:${A4_PAGE_WIDTH_PX}px`);
    expect(page).toContain('width:794px');
    expect(page).toContain('padding:48px 40px');
    expect(page).toContain(`min-height:${A4_PAGE_HEIGHT_PX}px`);
  });

  it('a folha do editor reserva a MESMA caixa de conteúdo do PDF', () => {
    const page = ruleBody(EDITOR_PAGE_CSS, '.a4-page');
    const width = Number(/width:(\d+)px/.exec(page)?.[1]);
    const [padY, padX] = (/padding:(\d+)px (\d+)px/.exec(page) ?? []).slice(1).map(Number);
    expect(width - 2 * padX).toBe(A4_CONTENT_WIDTH_PX);
    expect(A4_PAGE_HEIGHT_PX - 2 * padY).toBe(A4_CONTENT_HEIGHT_PX);
  });
});
