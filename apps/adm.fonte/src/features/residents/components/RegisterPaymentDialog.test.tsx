import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { FamilyInvestment, PaymentMethod } from '@fonte/types';
import type { ResidentReceivable } from '@fonte/api-client';

const mutate = vi.fn();
const reset = vi.fn();
let state = { isPending: false, isError: false, error: null as unknown };

vi.mock('../hooks/useResidentReceivables', () => ({
  useRegisterReceivablePayment: () => ({ mutate, reset, ...state }),
}));

import { RegisterPaymentDialog } from './RegisterPaymentDialog';

function receivable(overrides: Partial<ResidentReceivable> = {}): ResidentReceivable {
  return {
    id: 'rc1',
    amount: 700,
    familyInvestment: FamilyInvestment.PAYMENT_700,
    referenceMonth: '2026-06-01',
    ...overrides,
  } as ResidentReceivable;
}

function renderDialog(rec: ResidentReceivable | null = receivable()) {
  const onClose = vi.fn();
  render(
    <RegisterPaymentDialog
      open
      onClose={onClose}
      residentId="res1"
      residentName="Filho A"
      receivable={rec}
    />,
  );
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false, isError: false, error: null };
});
afterEach(() => cleanup());

describe('RegisterPaymentDialog', () => {
  it('mostra nome do filho, mês de referência e valor', () => {
    renderDialog();
    expect(screen.getByText('Registrar pagamento')).toBeInTheDocument();
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(
      screen.getByText((_t, el) => /R\$\s*700/.test(el?.textContent ?? '') && el?.tagName === 'P'),
    ).toBeInTheDocument();
  });

  it('submit válido muta com receivableId, método e valor; fecha no sucesso', async () => {
    const { onClose } = renderDialog();
    mutate.mockImplementation((_data, opts) => opts.onSuccess());
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const arg = mutate.mock.calls[0][0];
    expect(arg.receivableId).toBe('rc1');
    expect(arg.paymentMethod).toBe(PaymentMethod.PIX);
    expect(arg.paidAmount).toBe(700);
    expect(onClose).toHaveBeenCalled();
  });

  it('anexar comprovante mostra o nome', () => {
    renderDialog();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'pix.png')] } });
    expect(screen.getByText('pix.png')).toBeInTheDocument();
  });

  it('mostra erro da mutation', () => {
    state = { isPending: false, isError: true, error: new Error('boom') };
    renderDialog();
    expect(screen.getByText(/Erro ao registrar pagamento|boom/)).toBeInTheDocument();
  });

  it('confirmar desabilitado sem receivable', () => {
    renderDialog(null);
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });

  it('pending mostra "Salvando..." e desabilita', () => {
    state = { isPending: true, isError: false, error: null };
    renderDialog();
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });
});
