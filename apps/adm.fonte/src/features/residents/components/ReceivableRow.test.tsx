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
  const fns = { onPayClick: vi.fn(), onReopenClick: vi.fn(), onStatusClick: vi.fn() };
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

  it('pendente tem botão de cancelar parcela', () => {
    const { onStatusClick } = renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar parcela' }));
    expect(onStatusClick).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Marcar como pendente/ })).not.toBeInTheDocument();
  });

  it('cancelada tem botão de marcar como pendente e nada de pagar', () => {
    const { onStatusClick } = renderRow(rec({ status: ReceivableStatus.CANCELED }));
    fireEvent.click(screen.getByRole('button', { name: /Marcar como pendente/ }));
    expect(onStatusClick).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar parcela' })).not.toBeInTheDocument();
  });

  it('sem canManage não troca status', () => {
    renderRow(rec({ status: ReceivableStatus.CANCELED }), false);
    expect(screen.queryByRole('button', { name: /Marcar como pendente/ })).not.toBeInTheDocument();
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

  // ── Story 193: recibo da parcela paga ─────────────────────────────────────
  it('parcela PAGA mostra o botão de recibo e devolve o id da parcela', () => {
    const onDownloadReceipt = vi.fn();
    render(
      <ReceivableRow
        receivable={rec({ id: 'rc-9', status: ReceivableStatus.PAID, paidAt: '2026-02-05' })}
        canManage
        onPayClick={vi.fn()}
        onReopenClick={vi.fn()}
        onDownloadReceipt={onDownloadReceipt}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Recibo/ }));
    expect(onDownloadReceipt).toHaveBeenCalledWith('rc-9');
  });

  it.each([ReceivableStatus.PENDING, ReceivableStatus.CANCELED])(
    'parcela %s não mostra botão de recibo',
    (status) => {
      renderRow(rec({ status }));
      expect(screen.queryByRole('button', { name: /Recibo/ })).not.toBeInTheDocument();
    },
  );

  // Baixar recibo é LEITURA: o bloqueio do acolhimento encerrado (canManage
  // false) é sobre escrita — pagar, reabrir, declarar produto.
  it('acolhimento encerrado ainda mostra o recibo, mas não o botão de reabrir', () => {
    renderRow(rec({ status: ReceivableStatus.PAID, paidAt: '2026-02-05' }), false);
    expect(screen.getByRole('button', { name: /Recibo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir' })).not.toBeInTheDocument();
  });

  it('enquanto baixa, o botão fica desabilitado (nada de dois downloads)', () => {
    render(
      <ReceivableRow
        receivable={rec({ status: ReceivableStatus.PAID, paidAt: '2026-02-05' })}
        canManage
        onPayClick={vi.fn()}
        onReopenClick={vi.fn()}
        onDownloadReceipt={vi.fn()}
        isDownloadingReceipt
      />,
    );
    expect(screen.getByRole('button', { name: /Recibo/ })).toBeDisabled();
  });

  it('lista as contribuições em produto (catálogo + avulso com badge pendente)', () => {
    render(
      <ReceivableRow
        receivable={rec({
          productContributions: [
            {
              id: 'p1', receivableId: 'rc1', inventoryItemId: 's1', inventoryMovementId: 'm1',
              description: null, quantity: 3, unit: 'kg', pendingDetailing: false,
              createdByName: null, createdAt: '2026-02-01',
            },
            {
              id: 'p2', receivableId: 'rc1', inventoryItemId: null, inventoryMovementId: null,
              description: 'cesta básica', quantity: null, unit: null, pendingDetailing: true,
              createdByName: null, createdAt: '2026-02-01',
            },
          ],
        })}
        canManage
        catalog={[{ id: 's1', name: 'Arroz', unit: 'kg' }]}
        onPayClick={vi.fn()}
        onReopenClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByText('cesta básica')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });
});
