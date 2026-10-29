import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ReceivableStatus } from '@fonte/types';
import type { ResidentReceivable } from '@fonte/api-client';

const mutation = { mutate: vi.fn(), isPending: false };
vi.mock('../hooks/useResidentReceivables', () => ({
  useSetReceivableStatus: () => mutation,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { ChangeReceivableStatusDialog } from './ChangeReceivableStatusDialog';

const rec = (status: ReceivableStatus) =>
  ({ id: 'rc1', referenceMonth: '2026-10-01', status }) as unknown as ResidentReceivable;

afterEach(() => {
  cleanup();
  mutation.mutate.mockReset();
});

describe('ChangeReceivableStatusDialog', () => {
  it('pendente → confirma o cancelamento', () => {
    render(<ChangeReceivableStatusDialog residentId="r1" receivable={rec(ReceivableStatus.PENDING)} onClose={vi.fn()} />);
    expect(screen.getByText('Cancelar parcela de Outubro/2026?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar parcela' }));
    expect(mutation.mutate).toHaveBeenCalledWith(
      { receivableId: 'rc1', status: ReceivableStatus.CANCELED },
      expect.any(Object),
    );
  });

  it('cancelada → volta para pendente', () => {
    render(<ChangeReceivableStatusDialog residentId="r1" receivable={rec(ReceivableStatus.CANCELED)} onClose={vi.fn()} />);
    expect(screen.getByText('Marcar Outubro/2026 como pendente?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como pendente' }));
    expect(mutation.mutate).toHaveBeenCalledWith(
      { receivableId: 'rc1', status: ReceivableStatus.PENDING },
      expect.any(Object),
    );
  });

  it('sem parcela fica fechado', () => {
    render(<ChangeReceivableStatusDialog residentId="r1" receivable={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
