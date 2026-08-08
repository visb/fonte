import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FamilyInvestment, Role } from '@fonte/types';
import type { Admission, Resident, ResidentReceivable } from '@fonte/api-client';

const auth = { role: Role.ADMIN as Role };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

const recState = { data: [] as unknown[], isLoading: false, isError: false };
const reopenMutation = { mutate: vi.fn(), isPending: false };
vi.mock('../../hooks/useResidentReceivables', () => ({
  useResidentReceivables: () => recState,
  useReopenReceivable: () => reopenMutation,
  useSetContributionExempt: () => ({ mutate: vi.fn(), isPending: false }),
}));
const admissionsState = { data: [] as unknown[] };
const residentAdmissions = vi.fn((_id: string, _options?: { enabled?: boolean }) => admissionsState);
vi.mock('../../hooks/useResidents', () => ({
  useResidentAdmissions: (id: string, options?: { enabled?: boolean }) => residentAdmissions(id, options),
}));
const inventoryCatalog = vi.fn((_houseId: string | null, _options?: { enabled?: boolean }) => ({ data: [] as unknown[] }));
vi.mock('../../hooks/useProductContributions', () => ({
  useInventoryCatalog: (houseId: string | null, options?: { enabled?: boolean }) =>
    inventoryCatalog(houseId, options),
}));
vi.mock('../ChangeContributionPlanDialog', () => ({ ChangeContributionPlanDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="plan-dialog" /> : null) }));
vi.mock('../RegisterPaymentDialog', () => ({ RegisterPaymentDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="pay-dialog" /> : null) }));
vi.mock('../ReceivableRow', () => ({ ReceivableRow: ({ receivable, canManage, onReopenClick }: { receivable: { id: string }; canManage: boolean; onReopenClick: (r: unknown) => void }) => (
  <button data-testid={`rec-${receivable.id}`} data-can-manage={String(canManage)} onClick={() => onReopenClick(receivable)}>row</button>
) }));

import { ContributionsTab } from './ContributionsTab';

const resident = { id: 'r1', name: 'Fulano', houseId: 'h1', familyInvestment: 'BASKET_500', contributionExempt: false, contributionDueDay: 10 } as unknown as Resident;

function admission(over: Partial<Admission>): Admission {
  return {
    id: 'ad1',
    residentId: 'r1',
    houseId: 'h1',
    house: null,
    entryDate: '2026-07-17',
    exitDate: null,
    familyInvestment: null,
    familyInvestmentAmount: null,
    ...over,
  } as unknown as Admission;
}

function receivable(over: Partial<ResidentReceivable>): ResidentReceivable {
  return { id: 'rc1', admissionId: null, ...over } as unknown as ResidentReceivable;
}

// Duas admissões na ordem que o backend devolve: índice 0 = atual.
const CURRENT = admission({ id: 'ad-atual', entryDate: '2026-07-17', exitDate: null });
const PREVIOUS = admission({ id: 'ad-antigo', entryDate: '2025-08-01', exitDate: '2025-02-10' });

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = Role.ADMIN;
  recState.data = [];
  recState.isLoading = false;
  recState.isError = false;
  admissionsState.data = [];
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
    // as queries por casa ficam desligadas quando não há casa
    expect(inventoryCatalog).toHaveBeenCalledWith(null, expect.objectContaining({ enabled: false }));
    expect(residentAdmissions).toHaveBeenCalledWith('r1', expect.objectContaining({ enabled: false }));
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

  it('carregando mostra LoadingState', () => {
    recState.isLoading = true;
    render(<ContributionsTab resident={resident} />);
    expect(screen.queryByText('Nenhuma parcela gerada.')).not.toBeInTheDocument();
  });

  it('lista parcelas e abrir reabrir confirma a mutation', () => {
    recState.data = [receivable({ id: 'rc1' })];
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

  // ── story 164 ──────────────────────────────────────────────────────────────

  it('filho com UM acolhimento não ganha seletor (aba idêntica à de antes)', () => {
    admissionsState.data = [CURRENT];
    recState.data = [receivable({ id: 'rc1', admissionId: 'ad-atual' })];

    render(<ContributionsTab resident={resident} />);

    expect(screen.queryByLabelText('Acolhimento')).not.toBeInTheDocument();
    expect(screen.getByTestId('rec-rc1')).toBeInTheDocument();
  });

  it('filho com DOIS acolhimentos abre no atual e mostra só as parcelas dele', () => {
    admissionsState.data = [CURRENT, PREVIOUS];
    recState.data = [
      receivable({ id: 'antiga', admissionId: 'ad-antigo' }),
      receivable({ id: 'atual', admissionId: 'ad-atual' }),
    ];

    render(<ContributionsTab resident={resident} />);

    expect(screen.getByTestId('rec-atual')).toBeInTheDocument();
    expect(screen.queryByTestId('rec-antiga')).not.toBeInTheDocument();
    expect((screen.getByLabelText('Acolhimento') as HTMLSelectElement).value).toBe('ad-atual');
  });

  it('caso Marcelo: acolhimento atual sem parcela e sem plano mostra o CTA e nenhuma parcela antiga', () => {
    admissionsState.data = [CURRENT, PREVIOUS];
    recState.data = [receivable({ id: 'antiga', admissionId: 'ad-antigo' })];
    const semPlano = { ...resident, familyInvestment: null } as unknown as Resident;

    render(<ContributionsTab resident={semPlano} />);

    expect(screen.getByText('Plano de contribuição não definido.')).toBeInTheDocument();
    expect(screen.queryByTestId('rec-antiga')).not.toBeInTheDocument();

    // O CTA do estado vazio abre o mesmo diálogo de plano do card.
    const botoes = screen.getAllByRole('button', { name: /Alterar plano/ });
    expect(botoes).toHaveLength(2);
    fireEvent.click(botoes[1]);
    expect(screen.getByTestId('plan-dialog')).toBeInTheDocument();
  });

  it('trocar para o acolhimento anterior mostra as parcelas antigas em somente leitura', () => {
    admissionsState.data = [CURRENT, PREVIOUS];
    recState.data = [
      receivable({ id: 'antiga', admissionId: 'ad-antigo' }),
      receivable({ id: 'atual', admissionId: 'ad-atual' }),
    ];

    render(<ContributionsTab resident={resident} />);
    fireEvent.change(screen.getByLabelText('Acolhimento'), { target: { value: 'ad-antigo' } });

    expect(screen.getByTestId('rec-antiga')).toBeInTheDocument();
    expect(screen.queryByTestId('rec-atual')).not.toBeInTheDocument();
    expect(screen.getByTestId('rec-antiga')).toHaveAttribute('data-can-manage', 'false');
    expect(screen.getByText('Acolhimento encerrado — somente leitura')).toBeInTheDocument();
    // sem ações do card de plano no acolhimento encerrado
    expect(screen.queryByRole('button', { name: /Alterar plano/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Isentar/ })).not.toBeInTheDocument();
  });

  it('acolhimento anterior sem parcela mostra mensagem própria, sem CTA', () => {
    admissionsState.data = [CURRENT, PREVIOUS];
    recState.data = [receivable({ id: 'atual', admissionId: 'ad-atual' })];

    render(<ContributionsTab resident={resident} />);
    fireEvent.change(screen.getByLabelText('Acolhimento'), { target: { value: 'ad-antigo' } });

    expect(screen.getByText('Nenhuma parcela neste acolhimento.')).toBeInTheDocument();
    expect(screen.queryByText('Plano de contribuição não definido.')).not.toBeInTheDocument();
  });

  it('parcela órfã (admissionId null) aparece no acolhimento mais antigo', () => {
    admissionsState.data = [CURRENT, PREVIOUS];
    recState.data = [receivable({ id: 'orfa', admissionId: null })];

    render(<ContributionsTab resident={resident} />);
    expect(screen.queryByTestId('rec-orfa')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Acolhimento'), { target: { value: 'ad-antigo' } });
    expect(screen.getByTestId('rec-orfa')).toBeInTheDocument();
  });

  it('plano SOCIAL mantém a mensagem atual em vez do CTA', () => {
    admissionsState.data = [CURRENT];
    const social = { ...resident, familyInvestment: FamilyInvestment.SOCIAL } as unknown as Resident;

    render(<ContributionsTab resident={social} />);

    expect(screen.getByText('Plano social ou acolhido isento não geram parcelas.')).toBeInTheDocument();
    expect(screen.queryByText('Plano de contribuição não definido.')).not.toBeInTheDocument();
  });

  it('acolhido isento sem plano mantém a mensagem atual em vez do CTA', () => {
    admissionsState.data = [CURRENT];
    const isento = { ...resident, familyInvestment: null, contributionExempt: true } as unknown as Resident;

    render(<ContributionsTab resident={isento} />);

    expect(screen.getByText('Plano social ou acolhido isento não geram parcelas.')).toBeInTheDocument();
  });

  it('sem acolhimento nenhum, as parcelas órfãs continuam visíveis', () => {
    admissionsState.data = [];
    recState.data = [receivable({ id: 'orfa', admissionId: null })];

    render(<ContributionsTab resident={resident} />);

    expect(screen.getByTestId('rec-orfa')).toBeInTheDocument();
    expect(screen.queryByLabelText('Acolhimento')).not.toBeInTheDocument();
  });
});
