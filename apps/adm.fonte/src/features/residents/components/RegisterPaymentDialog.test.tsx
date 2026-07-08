import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { FamilyInvestment, PaymentMethod } from '@fonte/types';
import type { ResidentReceivable } from '@fonte/api-client';

const payMutateAsync = vi.fn();
const payReset = vi.fn();
const declareMutateAsync = vi.fn();
const declareReset = vi.fn();
let payState = { isPending: false, error: null as unknown };
let declareState = { isPending: false, error: null as unknown };

vi.mock('../hooks/useResidentReceivables', () => ({
  useRegisterReceivablePayment: () => ({ mutateAsync: payMutateAsync, reset: payReset, ...payState }),
}));

vi.mock('../hooks/useProductContributions', () => ({
  useDeclareProductContribution: () => ({
    mutateAsync: declareMutateAsync,
    reset: declareReset,
    ...declareState,
  }),
  useInventoryCatalog: () => ({
    data: [{ id: 's1', name: 'Arroz', unit: 'kg' }],
    isLoading: false,
  }),
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
      houseId="h1"
      receivable={rec}
    />,
  );
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  payState = { isPending: false, error: null };
  declareState = { isPending: false, error: null };
  payMutateAsync.mockResolvedValue(undefined);
  declareMutateAsync.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe('RegisterPaymentDialog', () => {
  it('mostra nome do filho, mês de referência e valor', () => {
    renderDialog();
    expect(screen.getByText('Registrar contribuição')).toBeInTheDocument();
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(
      screen.getByText((_t, el) => /R\$\s*700/.test(el?.textContent ?? '') && el?.tagName === 'P'),
    ).toBeInTheDocument();
  });

  it('submit padrão registra o pagamento em dinheiro e fecha; sem produtos não declara', async () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(payMutateAsync).toHaveBeenCalled());
    const arg = payMutateAsync.mock.calls[0][0];
    expect(arg.receivableId).toBe('rc1');
    expect(arg.paymentMethod).toBe(PaymentMethod.PIX);
    expect(arg.paidAmount).toBe(700);
    expect(declareMutateAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('anexar comprovante mostra o nome', () => {
    renderDialog();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'pix.png')] } });
    expect(screen.getByText('pix.png')).toBeInTheDocument();
  });

  it('mostra erro da mutation de pagamento', () => {
    payState = { isPending: false, error: new Error('boom') };
    renderDialog();
    expect(screen.getByText(/Erro ao registrar a contribuição|boom/)).toBeInTheDocument();
  });

  it('confirmar desabilitado sem receivable', () => {
    renderDialog(null);
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });

  it('pending mostra "Salvando..." e desabilita', () => {
    payState = { isPending: true, error: null };
    renderDialog();
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });

  it('adiciona um produto do catálogo e declara junto com o pagamento', async () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar produto/ }));
    fireEvent.change(screen.getByLabelText('Produto do catálogo'), { target: { value: 's1' } });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(declareMutateAsync).toHaveBeenCalled());
    expect(payMutateAsync).toHaveBeenCalled();
    const declared = declareMutateAsync.mock.calls[0][0];
    expect(declared.receivableId).toBe('rc1');
    expect(declared.lines).toEqual([{ inventoryItemId: 's1', quantity: 2, unit: 'kg' }]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('declara só produtos (sem pagamento) ao desmarcar dinheiro', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: /Registrar pagamento em dinheiro/ }));
    // Seção de dinheiro some.
    expect(screen.queryByText('Data do pagamento')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Adicionar produto/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Avulso' }));
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'cesta básica' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(declareMutateAsync).toHaveBeenCalled());
    expect(payMutateAsync).not.toHaveBeenCalled();
    const declared = declareMutateAsync.mock.calls[0][0];
    expect(declared.lines).toEqual([{ description: 'cesta básica', quantity: undefined, unit: undefined }]);
  });

  it('sem dinheiro e sem produtos acusa erro de validação e não muta', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: /Registrar pagamento em dinheiro/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => {
      expect(
        screen.getByText('Registre o pagamento em dinheiro ou adicione ao menos um produto.'),
      ).toBeInTheDocument();
    });
    expect(payMutateAsync).not.toHaveBeenCalled();
    expect(declareMutateAsync).not.toHaveBeenCalled();
  });
});
