import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PayableStatus, PayableCategory } from '@fonte/types';
import type { Payable } from '@fonte/api-client';
import { PayableRow } from './PayableRow';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string) => `cdn/${u}` } }));

function payable(over: Partial<Payable> = {}): Payable {
  return {
    id: 'p1', description: 'Conta de luz', amount: 15000, status: PayableStatus.OPEN,
    overdue: false, category: PayableCategory.UTILITIES, supplier: 'Enel',
    dueDate: '2026-02-01', attachmentUrl: null, attachmentName: null,
    ...over,
  } as unknown as Payable;
}

function renderRow(p: Payable = payable()) {
  const fns = { onView: vi.fn(), onEdit: vi.fn(), onPay: vi.fn(), onDelete: vi.fn() };
  render(<table><tbody><PayableRow payable={p} {...fns} /></tbody></table>);
  return fns;
}

afterEach(() => cleanup());

describe('PayableRow', () => {
  it('mostra descrição, categoria, fornecedor e valor', () => {
    renderRow();
    expect(screen.getByText('Conta de luz')).toBeInTheDocument();
    expect(screen.getByText('Enel')).toBeInTheDocument();
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
  });

  it('clicar na linha dispara onView', () => {
    const { onView } = renderRow();
    fireEvent.click(screen.getByText('Conta de luz'));
    expect(onView).toHaveBeenCalled();
  });

  it('OPEN mostra botão pagar; ações editar/excluir com stopPropagation', () => {
    const { onPay, onEdit, onDelete, onView } = renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como paga' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onPay).toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
    // stopPropagation: onView não foi chamado pelos botões
    expect(onView).not.toHaveBeenCalled();
  });

  it('PAID oculta o botão de pagar', () => {
    renderRow(payable({ status: PayableStatus.PAID }));
    expect(screen.queryByRole('button', { name: 'Marcar como paga' })).not.toBeInTheDocument();
  });

  it('com anexo mostra o link de paperclip', () => {
    renderRow(payable({ attachmentUrl: 'a.pdf', attachmentName: 'conta.pdf' }));
    expect(screen.getByTitle('conta.pdf')).toBeInTheDocument();
  });
});
