import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { FamilyInvestment } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

const mutate = vi.fn();
const reset = vi.fn();
let state = { isPending: false, isError: false, error: null as unknown };

vi.mock('../hooks/useResidentReceivables', () => ({
  useUpdateContributionPlan: () => ({ mutate, reset, ...state }),
}));

import { ChangeContributionPlanDialog } from './ChangeContributionPlanDialog';

function resident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: 'res1',
    familyInvestment: FamilyInvestment.PAYMENT_700,
    familyInvestmentAmount: null,
    contributionDueDay: null,
    ...overrides,
  } as Resident;
}

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false, isError: false, error: null };
});
afterEach(() => cleanup());

describe('ChangeContributionPlanDialog', () => {
  it('mostra título e campo de plano; sem valor negociado por padrão', () => {
    render(<ChangeContributionPlanDialog open onClose={vi.fn()} resident={resident()} />);
    expect(screen.getByText('Alterar plano de contribuição')).toBeInTheDocument();
    expect(screen.queryByText('Valor negociado (R$)')).not.toBeInTheDocument();
  });

  it('plano NEGOTIATED revela campo de valor', () => {
    render(<ChangeContributionPlanDialog open onClose={vi.fn()} resident={resident()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: FamilyInvestment.NEGOTIATED } });
    expect(screen.getByText('Valor negociado (R$)')).toBeInTheDocument();
  });

  it('NEGOTIATED sem valor mostra erro e não muta', async () => {
    render(<ChangeContributionPlanDialog open onClose={vi.fn()} resident={resident()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: FamilyInvestment.NEGOTIATED } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Informe o valor negociado')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('submit padrão muta com familyInvestmentAmount null (não negociado)', async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_data, opts) => opts.onSuccess());
    render(<ChangeContributionPlanDialog open onClose={onClose} resident={resident()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const arg = mutate.mock.calls[0][0];
    expect(arg.familyInvestment).toBe(FamilyInvestment.PAYMENT_700);
    expect(arg.familyInvestmentAmount).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('mostra erro da mutation', () => {
    state = { isPending: false, isError: true, error: new Error('boom') };
    render(<ChangeContributionPlanDialog open onClose={vi.fn()} resident={resident()} />);
    expect(screen.getByText(/Erro ao alterar plano|boom/)).toBeInTheDocument();
  });
});
