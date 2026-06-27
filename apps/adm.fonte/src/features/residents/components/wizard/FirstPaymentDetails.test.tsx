import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { FirstPaymentDetails } from './FirstPaymentDetails';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('FirstPaymentDetails', () => {
  it('renderiza método selecionado e o botão de anexar quando sem arquivo', () => {
    render(
      <FirstPaymentDetails method="PIX" onMethodChange={vi.fn()} file={null} onFileChange={vi.fn()} />,
    );
    expect(screen.getByText('Forma de pagamento')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PIX')).toBeInTheDocument();
    expect(screen.getByText('Clique para anexar arquivo')).toBeInTheDocument();
  });

  it('troca o método chamando onMethodChange', () => {
    const onMethodChange = vi.fn();
    render(
      <FirstPaymentDetails method="" onMethodChange={onMethodChange} file={null} onFileChange={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Dinheiro' } });
    expect(onMethodChange).toHaveBeenCalledWith('Dinheiro');
  });

  it('com arquivo mostra o nome e permite remover', () => {
    const onFileChange = vi.fn();
    const file = new File(['x'], 'comprovante.pdf', { type: 'application/pdf' });
    render(
      <FirstPaymentDetails method="PIX" onMethodChange={vi.fn()} file={file} onFileChange={onFileChange} />,
    );
    expect(screen.getByText('comprovante.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onFileChange).toHaveBeenCalledWith(null);
  });
});
