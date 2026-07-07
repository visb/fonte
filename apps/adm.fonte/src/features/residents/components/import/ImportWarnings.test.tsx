import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { ImportWarnings } from './ImportWarnings';

afterEach(() => cleanup());

describe('ImportWarnings', () => {
  it('não renderiza nada quando não há avisos', () => {
    const { container } = render(<ImportWarnings warnings={[]} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lista os avisos com o cabeçalho de atenção', () => {
    render(
      <ImportWarnings
        warnings={[
          { key: 'a', message: 'Revise o CPF' },
          { key: 'b', message: 'Revise o telefone' },
        ]}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/precisam de revisão manual/)).toBeInTheDocument();
    expect(screen.getByText('Revise o CPF')).toBeInTheDocument();
    expect(screen.getByText('Revise o telefone')).toBeInTheDocument();
  });

  it('dispensa um aviso pela sua key', () => {
    const onDismiss = vi.fn();
    render(
      <ImportWarnings warnings={[{ key: 'a', message: 'Revise o CPF' }]} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByLabelText('Dispensar alerta'));
    expect(onDismiss).toHaveBeenCalledWith('a');
  });

  it('exibe o rótulo do campo como prefixo quando presente', () => {
    render(
      <ImportWarnings
        warnings={[{ key: 'entryDate', label: 'Data de entrada', message: 'ficha=X, planilha=Y' }]}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Data de entrada:')).toBeInTheDocument();
    expect(screen.getByText(/ficha=X, planilha=Y/)).toBeInTheDocument();
  });

  it('sem onDismiss não renderiza botão de dispensa (uso do import em lote)', () => {
    render(
      <ImportWarnings
        warnings={[{ key: 'entryDate', label: 'Data de entrada', message: 'ficha=X' }]}
      />,
    );
    expect(screen.queryByLabelText('Dispensar alerta')).not.toBeInTheDocument();
    expect(screen.getByText('Data de entrada:')).toBeInTheDocument();
  });
});
