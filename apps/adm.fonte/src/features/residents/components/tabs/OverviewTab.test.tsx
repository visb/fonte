import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FamilyInvestment } from '@fonte/types';
import type { BibleCourseExternalCompletion, Resident } from '@fonte/api-client';

vi.mock('../GenerateResidentAccessDialog', () => ({
  GenerateResidentAccessDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="gen-access" /> : null,
}));
vi.mock('../ResetResidentPasswordDialog', () => ({
  ResetResidentPasswordDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reset-pwd" /> : null,
}));

// Story 149: a seção "Acesso Digital" (acesso do interno/RESIDENT) fica atrás
// da flag `RESIDENT_APP_ENABLED`, oculta enquanto o `resident.fonte` não está
// em produção. Getter mutável para exercitar os dois estados da flag.
let residentAppEnabled = false;
vi.mock('@/config/features', () => ({
  get RESIDENT_APP_ENABLED() {
    return residentAppEnabled;
  },
}));

const unmarkMutate = vi.fn();
const useResidentExternalCompletion = vi.fn();
vi.mock('@/features/bible-courses/hooks/useBibleCourses', () => ({
  useResidentExternalCompletion: (...args: unknown[]) => useResidentExternalCompletion(...args),
  useUnmarkExternalCompletion: () => ({ mutate: unmarkMutate, isPending: false }),
}));

import { OverviewTab } from './OverviewTab';

/** Marcação de curso feito fora do sistema (story 127). */
function completion(over: Partial<BibleCourseExternalCompletion> = {}): BibleCourseExternalCompletion {
  return {
    residentId: 'r1',
    markedAt: '2026-07-17T12:00:00.000Z',
    markedBy: { id: 'u1', name: 'Coord Maria' },
    ...over,
  };
}

function res(over: Partial<Resident> = {}): Resident {
  return {
    id: 'r1', name: 'Fulano', cpf: '12345678900', rg: '123456', nationality: 'Brasileiro',
    birthDate: '1990-05-10', gender: 'MALE', entryDate: '2024-01-15', exitDate: null,
    contactPhone: '11999998888', email: 'f@x.com', city: 'SP', state: 'SP', address: 'Rua A',
    maritalStatus: 'SINGLE', children: 2, occupation: 'Pedreiro', education: 'Médio',
    religion: 'Evangélico', addiction: 'Álcool', healthIssues: null, continuousMedication: null,
    weight: 80, height: 175, familyInvestment: null, familyInvestmentAmount: null,
    contributionDueDay: 10, userId: null,
    house: { name: 'Casa Belém' }, ministry: { name: 'Cozinha' },
    ...over,
  } as unknown as Resident;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Flag desligada por padrão (app do interno fora de produção).
  residentAppEnabled = false;
  // Sem marcação por padrão: o campo "Curso bíblico" é exceção, não regra.
  useResidentExternalCompletion.mockReturnValue({ data: undefined });
});
afterEach(() => cleanup());

describe('OverviewTab', () => {
  it('mostra identificação, idade calculada e máscaras', () => {
    render(<OverviewTab resident={res()} />);
    expect(screen.getByText('Fulano')).toBeInTheDocument();
    expect(screen.getByText('123.456.789-00')).toBeInTheDocument();
    expect(screen.getByText(/anos\)/)).toBeInTheDocument();
    expect(screen.getByText('Masculino')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
  });

  it('valores vazios viram travessão', () => {
    render(<OverviewTab resident={res({ cpf: null, nationality: null, healthIssues: null })} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  // Story 151 — CPF/RG redigidos pelo backend (`***.***.789-00` / `***XX`) para
  // não-privilegiados são exibidos as-is; nunca reprocessados em `789.00`.
  it('mostra CPF/RG redigidos as-is, sem reprocessar em 789.00', () => {
    render(<OverviewTab resident={res({ cpf: '***.***.789-00', rg: '***XX' })} />);
    expect(screen.getByText('***.***.789-00')).toBeInTheDocument();
    expect(screen.getByText('***XX')).toBeInTheDocument();
    expect(screen.queryByText('789.00')).not.toBeInTheDocument();
  });

  it('investimento NEGOTIATED mostra o valor; oculta vencimento p/ SOCIAL', () => {
    const { rerender } = render(
      <OverviewTab resident={res({ familyInvestment: FamilyInvestment.NEGOTIATED, familyInvestmentAmount: 350 })} />,
    );
    expect(screen.getByText(/R\$ 350/)).toBeInTheDocument();
    expect(screen.getByText('Dia de vencimento da contribuição')).toBeInTheDocument();
    rerender(<OverviewTab resident={res({ familyInvestment: FamilyInvestment.SOCIAL })} />);
    expect(screen.queryByText('Dia de vencimento da contribuição')).not.toBeInTheDocument();
  });

});

// Story 149: acesso do interno (RESIDENT) só aparece quando o `resident.fonte`
// entrar em produção; hoje a seção inteira fica atrás da flag e não renderiza.
describe('OverviewTab — seção "Acesso Digital" atrás da flag RESIDENT_APP_ENABLED (story 149)', () => {
  it('flag desligada (default): não renderiza a seção para filho SEM acesso', () => {
    render(<OverviewTab resident={res({ userId: null })} />);
    expect(screen.queryByText('Acesso Digital')).not.toBeInTheDocument();
    expect(screen.queryByText('Sem acesso gerado.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar Acesso/ })).not.toBeInTheDocument();
  });

  it('flag desligada (default): não renderiza a seção para filho COM acesso', () => {
    render(<OverviewTab resident={res({ userId: 'u1', user: { email: 'f@x.com' } } as Partial<Resident>)} />);
    expect(screen.queryByText('Acesso Digital')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resetar Senha/ })).not.toBeInTheDocument();
  });

  it('flag ligada: volta a renderizar e abre o diálogo de gerar acesso (filho SEM acesso)', () => {
    residentAppEnabled = true;
    render(<OverviewTab resident={res({ userId: null })} />);
    expect(screen.getByText('Acesso Digital')).toBeInTheDocument();
    expect(screen.getByText('Sem acesso gerado.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gerar Acesso/ }));
    expect(screen.getByTestId('gen-access')).toBeInTheDocument();
  });

  it('flag ligada: mostra email e abre reset de senha (filho COM acesso)', () => {
    residentAppEnabled = true;
    render(<OverviewTab resident={res({ userId: 'u1', user: { email: 'f@x.com' } } as Partial<Resident>)} />);
    expect(screen.getByText('Acesso Digital')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Resetar Senha/ }));
    expect(screen.getByTestId('reset-pwd')).toBeInTheDocument();
  });
});

// Story 127: a ficha é o ponto permanente de desfazer (decisão 5) e o lugar
// onde o fato "fez o curso fora do sistema" vive — não é só um filtro da lista.
describe('OverviewTab — curso bíblico feito fora do sistema (story 127)', () => {
  it('mostra a linha com quem marcou e quando', () => {
    useResidentExternalCompletion.mockReturnValue({ data: completion() });
    render(<OverviewTab resident={res()} canManage />);

    expect(screen.getByText('Curso bíblico')).toBeInTheDocument();
    expect(
      screen.getByText(/Concluído fora do sistema · marcado por Coord Maria em 17\/07\/2026/),
    ).toBeInTheDocument();
  });

  // Sem marcação o sistema não sabe se o filho fez o curso fora daqui: a linha
  // some em vez de afirmar "não fez".
  it('não mostra a linha quando não há marcação', () => {
    useResidentExternalCompletion.mockReturnValue({ data: undefined });
    render(<OverviewTab resident={res()} canManage />);

    expect(screen.queryByText('Curso bíblico')).not.toBeInTheDocument();
    expect(screen.queryByText(/Concluído fora do sistema/)).not.toBeInTheDocument();
  });

  it('"Remover marcação" desfaz com id e nome do filho', () => {
    useResidentExternalCompletion.mockReturnValue({ data: completion() });
    render(<OverviewTab resident={res()} canManage />);

    fireEvent.click(screen.getByRole('button', { name: 'Remover marcação' }));

    expect(unmarkMutate).toHaveBeenCalledWith({ residentId: 'r1', residentName: 'Fulano' });
  });

  it('sem canManage não mostra "Remover marcação"', () => {
    useResidentExternalCompletion.mockReturnValue({ data: completion() });
    render(<OverviewTab resident={res()} canManage={false} />);

    expect(screen.queryByRole('button', { name: 'Remover marcação' })).not.toBeInTheDocument();
  });

  // O endpoint da marcação é ADMIN/COORDINATOR: sem permissão a query nem roda.
  it('desliga a query de marcação para quem não pode gerenciar', () => {
    render(<OverviewTab resident={res()} />);
    expect(useResidentExternalCompletion).toHaveBeenCalledWith('r1', { enabled: false });

    cleanup();
    render(<OverviewTab resident={res()} canManage />);
    expect(useResidentExternalCompletion).toHaveBeenCalledWith('r1', { enabled: true });
  });

  // FK ON DELETE SET NULL: o staff que marcou pode ter sido removido; o fato
  // sobrevive a ele, então o texto omite o autor em vez de mostrar vazio.
  it('omite o autor quando quem marcou foi removido', () => {
    useResidentExternalCompletion.mockReturnValue({ data: completion({ markedBy: null }) });
    render(<OverviewTab resident={res()} canManage />);

    expect(screen.getByText(/Concluído fora do sistema em 17\/07\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/marcado por/)).not.toBeInTheDocument();
  });
});
