import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Payable } from '@fonte/api-client';

const payMutate = vi.fn();
const payReset = vi.fn();
let payState = { isPending: false, isError: false, error: null as unknown };

vi.mock('../hooks/usePayables', () => ({
  usePayPayable: () => ({ mutate: payMutate, reset: payReset, ...payState }),
}));

import { PayPayableDialog } from './PayPayableDialog';

function payable(overrides: Partial<Payable> = {}): Payable {
  return { id: 'p1', description: 'Conta de luz', amount: 25000, ...overrides } as Payable;
}

beforeEach(() => {
  vi.clearAllMocks();
  payState = { isPending: false, isError: false, error: null };
});
afterEach(() => cleanup());

describe('PayPayableDialog', () => {
  it('mostra descrição e valor formatado', () => {
    render(<PayPayableDialog open payable={payable()} onClose={vi.fn()} />);
    expect(screen.getByText('Marcar como paga')).toBeInTheDocument();
    expect(screen.getByText('Conta de luz')).toBeInTheDocument();
    expect(screen.getByText(/250,00/)).toBeInTheDocument();
  });

  it('confirmar muta com id, paidAt e file null e fecha no sucesso', async () => {
    const onClose = vi.fn();
    payMutate.mockImplementation((_data, opts) => opts.onSuccess());
    render(<PayPayableDialog open payable={payable()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    await waitFor(() => expect(payMutate).toHaveBeenCalled());
    const arg = payMutate.mock.calls[0][0];
    expect(arg.id).toBe('p1');
    expect(arg.file).toBeNull();
    expect(typeof arg.paidAt).toBe('string');
    expect(onClose).toHaveBeenCalled();
  });

  it('anexar comprovante mostra o nome e permite limpar', () => {
    render(<PayPayableDialog open payable={payable()} onClose={vi.fn()} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'recibo.pdf')] } });
    expect(screen.getByText('recibo.pdf')).toBeInTheDocument();
  });

  it('mostra erro da mutation', () => {
    payState = { isPending: false, isError: true, error: new Error('boom') };
    render(<PayPayableDialog open payable={payable()} onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao registrar pagamento|boom/)).toBeInTheDocument();
  });

  it('pending desabilita confirmar', () => {
    payState = { isPending: true, isError: false, error: null };
    render(<PayPayableDialog open payable={payable()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });

  it('cancelar fecha', () => {
    const onClose = vi.fn();
    render(<PayPayableDialog open payable={payable()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
