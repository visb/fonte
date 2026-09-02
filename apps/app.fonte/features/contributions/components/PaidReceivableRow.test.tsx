import { render, screen, fireEvent } from '@testing-library/react-native';
import type { RelativePaidReceivable } from '@fonte/api-client';
import { PaidReceivableRow } from './PaidReceivableRow';

function receivable(over: Partial<RelativePaidReceivable> = {}): RelativePaidReceivable {
  return {
    id: 'rcv-1',
    referenceMonth: '2026-08-01',
    paidAmount: 480,
    paidAt: '2026-08-09',
    paymentMethod: 'PIX',
    ...over,
  } as RelativePaidReceivable;
}

describe('PaidReceivableRow (story 193)', () => {
  it('mostra competência, data, forma de pagamento e valor pago', () => {
    render(
      <PaidReceivableRow receivable={receivable()} onDownloadReceipt={jest.fn()} />,
    );
    expect(screen.getByText('Agosto de 2026')).toBeTruthy();
    expect(screen.getByText('Pago em 09/08/2026 · PIX')).toBeTruthy();
    expect(screen.getByText(/480,00/)).toBeTruthy();
  });

  it('sem forma de pagamento, a linha não imprime separador solto', () => {
    render(
      <PaidReceivableRow
        receivable={receivable({ paymentMethod: null })}
        onDownloadReceipt={jest.fn()}
      />,
    );
    expect(screen.getByText('Pago em 09/08/2026')).toBeTruthy();
  });

  it('o botão de recibo devolve o id da parcela', () => {
    const onDownloadReceipt = jest.fn();
    render(
      <PaidReceivableRow receivable={receivable()} onDownloadReceipt={onDownloadReceipt} />,
    );
    fireEvent.press(screen.getByLabelText('Baixar recibo de Agosto de 2026'));
    expect(onDownloadReceipt).toHaveBeenCalledWith('rcv-1');
  });

  it('enquanto baixa, o botão fica desabilitado (nada de dois downloads)', () => {
    const onDownloadReceipt = jest.fn();
    render(
      <PaidReceivableRow
        receivable={receivable()}
        onDownloadReceipt={onDownloadReceipt}
        isDownloading
      />,
    );
    fireEvent.press(screen.getByLabelText('Baixar recibo de Agosto de 2026'));
    expect(onDownloadReceipt).not.toHaveBeenCalled();
  });
});
