import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  A4_CONTENT_HEIGHT_PX,
  A4_MARGIN_TOP_PX,
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
  EDITOR_PAGE_CSS,
} from '@fonte/doc-styles';
import { A4EditorFrame } from './A4EditorFrame';

afterEach(() => cleanup());

describe('A4EditorFrame', () => {
  it('renders the children inside the A4 sheet and injects the shared editor CSS', () => {
    const { container } = render(
      <A4EditorFrame>
        <p>conteúdo do template</p>
      </A4EditorFrame>,
    );

    const sheet = screen.getByTestId('a4-page');
    expect(sheet).toHaveTextContent('conteúdo do template');
    // Uma fonte de verdade: o CSS da folha vem do pacote, não é reescrito aqui.
    expect(container.querySelector('style')?.textContent).toBe(EDITOR_PAGE_CSS);
  });

  it('scales the sheet by the selected zoom', () => {
    render(
      <A4EditorFrame>
        <p>x</p>
      </A4EditorFrame>,
    );
    const sheet = screen.getByTestId('a4-page');
    expect(sheet).toHaveStyle({ transform: 'scale(1)' });

    fireEvent.click(screen.getByRole('button', { name: '50%' }));
    expect(sheet).toHaveStyle({ transform: 'scale(0.5)' });
  });

  // Story 154 — geometria compartilhada. A altura útil declarada é a página A4
  // menos as DUAS margens verticais e é exatamente o passo usado pelo guia de
  // quebra do editor. Enquanto a margem era o `padding` do body (caixa do fluxo),
  // a altura útil real da 1ª página era 1075px e a das seguintes 1123px — os
  // 1027px do guia eram uma promessa que o PDF não cumpria. Com a margem na
  // página, o número passa a valer para TODAS as páginas: é esse casamento
  // editor↔PDF que este teste tranca.
  it('draws the page-break guide at the SAME usable height the PDF uses', () => {
    render(
      <A4EditorFrame>
        <p>x</p>
      </A4EditorFrame>,
    );
    const sheet = screen.getByTestId('a4-page');

    expect(A4_CONTENT_HEIGHT_PX).toBe(A4_PAGE_HEIGHT_PX - 2 * A4_MARGIN_TOP_PX);

    // A 1ª quebra fica em margem-do-topo + altura útil; as seguintes se repetem a
    // cada página A4 cheia. O `backgroundPosition` é o deslocamento que coloca a
    // primeira listra do gradiente exatamente nesse offset.
    const firstBreak = A4_MARGIN_TOP_PX + A4_CONTENT_HEIGHT_PX;
    expect(firstBreak).toBe(1075);
    expect(sheet).toHaveStyle({
      backgroundPosition: `0px ${firstBreak - (A4_PAGE_HEIGHT_PX - 2)}px`,
    });
    expect(sheet.style.backgroundImage).toContain(`${A4_PAGE_HEIGHT_PX}px`);
    // A folha continua com a largura real da página, independente do zoom.
    expect(A4_PAGE_WIDTH_PX).toBe(794);
  });
});
