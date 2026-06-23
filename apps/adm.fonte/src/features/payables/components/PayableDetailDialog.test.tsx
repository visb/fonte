import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PayableStatus, PayableCategory } from '@fonte/types';
import type { Payable } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string) => `cdn/${u}` } }));

import { PayableDetailDialog } from './PayableDetailDialog';

function payable(over: Partial<Payable> = {}): Payable {
  return {
    id: 'p1', description: 'Conta de luz', amount: 15000, status: PayableStatus.OPEN,
    overdue: false, category: PayableCategory.UTILITIES, supplier: 'Enel',
    dueDate: '2026-02-01', paidAt: null, notes: null,
    attachmentUrl: null, attachmentName: null, paymentReceiptUrl: null, paymentReceiptName: null,
    ...over,
  } as unknown as Payable;
}

function renderDialog(p: Payable | null = payable()) {
  const fns = { onClose: vi.fn(), onEdit: vi.fn(), onPay: vi.fn(), onDelete: vi.fn() };
  render(<PayableDetailDialog open payable={p} {...fns} />);
  return fns;
}

afterEach(() => cleanup());

describe('PayableDetailDialog', () => {
  it('payable null não renderiza', () => {
    const { container } = render(<PayableDetailDialog open payable={null} onClose={vi.fn()} onEdit={vi.fn()} onPay={vi.fn()} onDelete={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('mostra descrição, valor formatado, categoria e fornecedor', () => {
    renderDialog();
    expect(screen.getByText('Conta de luz')).toBeInTheDocument();
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
    expect(screen.getByText('Enel')).toBeInTheDocument();
  });

  it('OPEN mostra "Marcar como paga"; PAID oculta', () => {
    const { rerender } = render(<PayableDetailDialog open payable={payable()} onClose={vi.fn()} onEdit={vi.fn()} onPay={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Marcar como paga/ })).toBeInTheDocument();
    rerender(<PayableDetailDialog open payable={payable({ status: PayableStatus.PAID })} onClose={vi.fn()} onEdit={vi.fn()} onPay={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Marcar como paga/ })).not.toBeInTheDocument();
  });

  it('mostra link da conta anexada e do comprovante quando presentes', () => {
    renderDialog(payable({ attachmentUrl: 'a.pdf', attachmentName: 'conta.pdf', paymentReceiptUrl: 'r.pdf', paymentReceiptName: 'recibo.pdf' }));
    expect(screen.getByText('conta.pdf')).toBeInTheDocument();
    expect(screen.getByText('recibo.pdf')).toBeInTheDocument();
  });

  it('callbacks de editar, pagar e excluir disparam', () => {
    const { onEdit, onPay, onDelete } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Marcar como paga/ }));
    fireEvent.click(screen.getByRole('button', { name: /Excluir/ }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
    expect(onPay).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
