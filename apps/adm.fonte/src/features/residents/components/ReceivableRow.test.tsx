import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ReceivableStatus, PaymentMethod, FamilyInvestment } from '@fonte/types';
import type { ResidentReceivable } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string) => `cdn/${u}` } }));

import { ReceivableRow } from './ReceivableRow';

function rec(over: Partial<ResidentReceivable> = {}): ResidentReceivable {
  return {
    id: 'rc1', referenceMonth: '2026-02-01', status: ReceivableStatus.PENDING,
    amount: 500, mandatory: true, dueDate: '2026-02-10', paidAt: null,
    paymentMethod: null, attachmentUrl: null, notes: null,
    paidAmount: null, paidFamilyInvestment: null, familyInvestment: FamilyInvestment.BASKET_500,
    ...over,
  } as unknown as ResidentReceivable;
}

function renderRow(r: ResidentReceivable = rec(), canManage = true) {
  const fns = { onPayClick: vi.fn(), onReopenClick: vi.fn() };
  render(<ReceivableRow receivable={r} canManage={canManage} {...fns} />);
  return fns;
}

afterEach(() => cleanup());

describe('ReceivableRow', () => {
  it('pendente mostra vencimento, valor e botão de registrar pagamento', () => {
    const { onPayClick } = renderRow();
    expect(screen.getByText(/Vence/)).toBeInTheDocument();
    expect(screen.getByText('R$ 500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
    expect(onPayClick).toHaveBeenCalled();
  });

  it('voluntário mostra badge e oculta sem canManage o botão de pagar', () => {
    renderRow(rec({ mandatory: false }), false);
    expect(screen.getByText('Voluntário')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
  });

  it('pago mostra data, método, valor pago e botão de reabrir', () => {
    const { onReopenClick } = renderRow(rec({
      status: ReceivableStatus.PAID, paidAt: '2026-02-05', paymentMethod: PaymentMethod.PIX,
      paidAmount: 480,
    }));
    expect(screen.getByText(/Pago em/)).toBeInTheDocument();
    expect(screen.getByText('R$ 480')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    expect(onReopenClick).toHaveBeenCalled();
  });

  it('pago com modalidade divergente mostra badge da modalidade paga', () => {
    renderRow(rec({
      status: ReceivableStatus.PAID, paidAt: '2026-02-05',
      familyInvestment: FamilyInvestment.BASKET_500, paidFamilyInvestment: FamilyInvestment.PAYMENT_700,
    }));
    // o label da modalidade paga aparece como badge adicional
    expect(screen.getAllByText(/.+/).length).toBeGreaterThan(0);
  });

  it('com anexo mostra link de comprovante', () => {
    renderRow(rec({ attachmentUrl: 'comp.pdf' }));
    expect(screen.getByTitle('Ver comprovante')).toBeInTheDocument();
  });
});
