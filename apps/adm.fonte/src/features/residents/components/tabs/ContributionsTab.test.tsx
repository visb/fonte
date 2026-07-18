import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Role } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

const auth = { role: Role.ADMIN as Role };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

const recState = { data: [] as unknown[], isLoading: false, isError: false };
const reopenMutation = { mutate: vi.fn(), isPending: false };
vi.mock('../../hooks/useResidentReceivables', () => ({
  useResidentReceivables: () => recState,
  useReopenReceivable: () => reopenMutation,
  useSetContributionExempt: () => ({ mutate: vi.fn(), isPending: false }),
}));
const inventoryCatalog = vi.fn((_houseId: string | null, _options?: { enabled?: boolean }) => ({ data: [] as unknown[] }));
vi.mock('../../hooks/useProductContributions', () => ({
  useInventoryCatalog: (houseId: string | null, options?: { enabled?: boolean }) =>
    inventoryCatalog(houseId, options),
}));
vi.mock('../ChangeContributionPlanDialog', () => ({ ChangeContributionPlanDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="plan-dialog" /> : null) }));
vi.mock('../RegisterPaymentDialog', () => ({ RegisterPaymentDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="pay-dialog" /> : null) }));
vi.mock('../ReceivableRow', () => ({ ReceivableRow: ({ receivable, onReopenClick }: { receivable: { id: string }; onReopenClick: (r: unknown) => void }) => (
  <button data-testid={`rec-${receivable.id}`} onClick={() => onReopenClick(receivable)}>row</button>
) }));

import { ContributionsTab } from './ContributionsTab';

const resident = { id: 'r1', name: 'Fulano', houseId: 'h1', familyInvestment: 'BASKET_500', contributionExempt: false, contributionDueDay: 10 } as unknown as Resident;

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = Role.ADMIN;
  recState.data = [];
  recState.isLoading = false;
  recState.isError = false;
});
afterEach(() => cleanup());

describe('ContributionsTab', () => {
  it('sem permissão mostra mensagem e nada mais', () => {
    auth.role = Role.SERVANT;
    render(<ContributionsTab resident={resident} />);
    expect(screen.getByText('Sem permissão para ver a contribuição.')).toBeInTheDocument();
  });

  it('sem casa (houseId null) mostra estado vazio coerente e não consulta o catálogo', () => {
    const semCasa = { ...resident, houseId: null } as unknown as Resident;
    render(<ContributionsTab resident={semCasa} />);
    expect(screen.getByText('Sem carnê de contribuição.')).toBeInTheDocument();
    // o card de plano e as parcelas não renderizam sem casa
    expect(screen.queryByText('Plano')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhuma parcela gerada.')).not.toBeInTheDocument();
    // a query de inventário fica desligada quando não há casa
    expect(inventoryCatalog).toHaveBeenCalledWith(null, expect.objectContaining({ enabled: false }));
  });

  it('sem parcelas mostra empty state e o card de plano', () => {
    render(<ContributionsTab resident={resident} />);
    expect(screen.getByText('Nenhuma parcela gerada.')).toBeInTheDocument();
    expect(screen.getByText('Plano')).toBeInTheDocument();
  });

  it('erro mostra ErrorState', () => {
    recState.isError = true;
    render(<ContributionsTab resident={resident} />);
    expect(screen.getByText('Erro ao carregar o carnê.')).toBeInTheDocument();
  });

  it('lista parcelas e abrir reabrir confirma a mutation', () => {
    recState.data = [{ id: 'rc1' }];
    render(<ContributionsTab resident={resident} />);
    fireEvent.click(screen.getByTestId('rec-rc1'));
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    expect(reopenMutation.mutate).toHaveBeenCalledWith('rc1', expect.any(Object));
  });

  it('alterar plano abre o diálogo', () => {
    render(<ContributionsTab resident={resident} />);
    fireEvent.click(screen.getByRole('button', { name: /Alterar plano/ }));
    expect(screen.getByTestId('plan-dialog')).toBeInTheDocument();
  });
});
