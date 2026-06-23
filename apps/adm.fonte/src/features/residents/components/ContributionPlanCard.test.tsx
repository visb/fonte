import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FamilyInvestment } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

const exemptMutation = { mutate: vi.fn(), isPending: false };
vi.mock('../hooks/useResidentReceivables', () => ({
  useSetContributionExempt: () => exemptMutation,
}));

import { ContributionPlanCard } from './ContributionPlanCard';

function res(over: Partial<Resident> = {}): Resident {
  return {
    id: 'r1', familyInvestment: FamilyInvestment.BASKET_500, familyInvestmentAmount: null,
    contributionDueDay: 10, contributionExempt: false,
    ...over,
  } as unknown as Resident;
}

beforeEach(() => {
  vi.clearAllMocks();
  exemptMutation.mutate = vi.fn();
});
afterEach(() => cleanup());

describe('ContributionPlanCard', () => {
  it('mostra plano e vencimento; valor negociado quando NEGOTIATED', () => {
    const { rerender } = render(<ContributionPlanCard resident={res()} canManage={false} onChangePlan={vi.fn()} />);
    expect(screen.getByText(/Dia 10/)).toBeInTheDocument();
    rerender(<ContributionPlanCard resident={res({ familyInvestment: FamilyInvestment.NEGOTIATED, familyInvestmentAmount: 350 })} canManage={false} onChangePlan={vi.fn()} />);
    expect(screen.getByText(/R\$ 350/)).toBeInTheDocument();
  });

  it('SOCIAL mostra badge de isento e oculta vencimento', () => {
    render(<ContributionPlanCard resident={res({ familyInvestment: FamilyInvestment.SOCIAL })} canManage onChangePlan={vi.fn()} />);
    expect(screen.getByText('Isento de contribuição')).toBeInTheDocument();
    expect(screen.queryByText(/Vencimento:/)).not.toBeInTheDocument();
  });

  it('canManage mostra "Alterar plano" e dispara o callback', () => {
    const onChangePlan = vi.fn();
    render(<ContributionPlanCard resident={res()} canManage onChangePlan={onChangePlan} />);
    fireEvent.click(screen.getByRole('button', { name: /Alterar plano/ }));
    expect(onChangePlan).toHaveBeenCalled();
  });

  it('isentar abre confirmação e confirma muta com true', () => {
    render(<ContributionPlanCard resident={res({ contributionExempt: false })} canManage onChangePlan={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Isentar/ }));
    expect(screen.getByText('Isentar acolhido?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(exemptMutation.mutate).toHaveBeenCalledWith(true, expect.any(Object));
  });

  it('já isento: remover isenção muta com false', () => {
    render(<ContributionPlanCard resident={res({ contributionExempt: true })} canManage onChangePlan={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Remover isenção/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(exemptMutation.mutate).toHaveBeenCalledWith(false, expect.any(Object));
  });

  it('sem canManage não mostra ações de isenção', () => {
    render(<ContributionPlanCard resident={res()} canManage={false} onChangePlan={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Isentar/ })).not.toBeInTheDocument();
  });
});
