import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChargeStatus } from '@fonte/types';
import type { AssociateCharge } from '@fonte/api-client';
import { Table, TableBody } from '@/components/ui/table';
import { ChargeRow } from './ChargeRow';

afterEach(() => cleanup());

function charge(overrides: Partial<AssociateCharge> = {}): AssociateCharge {
  return {
    id: 'c1',
    associateId: 'a1',
    grossAmount: 51.75,
    netAmount: 50,
    feeAmount: 1.75,
    status: ChargeStatus.PAID,
    dueDate: '2026-08-10',
    paidAt: '2026-08-09T12:00:00.000Z',
    ...overrides,
  } as AssociateCharge;
}

function renderRow(props: Partial<Parameters<typeof ChargeRow>[0]> = {}) {
  return render(
    <Table>
      <TableBody>
        <ChargeRow charge={charge()} {...props} />
      </TableBody>
    </Table>,
  );
}

describe('ChargeRow — botão de recibo (story 178)', () => {
  it('cobrança PAGA mostra o botão de recibo', () => {
    renderRow();
    expect(screen.getByRole('button', { name: /Recibo/i })).toBeInTheDocument();
  });

  it.each([ChargeStatus.PENDING, ChargeStatus.FAILED])(
    'cobrança %s NÃO mostra o botão (não há o que dar por recebido)',
    (status) => {
      renderRow({ charge: charge({ status, paidAt: null }) });
      expect(screen.queryByRole('button', { name: /Recibo/i })).not.toBeInTheDocument();
    },
  );

  it('clicar dispara o download com o id da cobrança', () => {
    const onDownloadReceipt = vi.fn();
    renderRow({ onDownloadReceipt });
    fireEvent.click(screen.getByRole('button', { name: /Recibo/i }));
    expect(onDownloadReceipt).toHaveBeenCalledWith('c1');
  });

  it('durante o download o botão fica desabilitado (evita dois cliques)', () => {
    const onDownloadReceipt = vi.fn();
    renderRow({ onDownloadReceipt, isDownloadingReceipt: true });
    const button = screen.getByRole('button', { name: /Recibo/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onDownloadReceipt).not.toHaveBeenCalled();
  });

  it('mostra vencimento, valor e data de pagamento', () => {
    renderRow();
    expect(screen.getByText('10/08/2026')).toBeInTheDocument();
    expect(screen.getByText(/51,75/)).toBeInTheDocument();
    expect(screen.getByText('09/08/2026')).toBeInTheDocument();
  });
});
