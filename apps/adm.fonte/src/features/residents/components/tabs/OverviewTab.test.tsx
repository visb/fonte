import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FamilyInvestment } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

vi.mock('../GenerateResidentAccessDialog', () => ({
  GenerateResidentAccessDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="gen-access" /> : null,
}));
vi.mock('../ResetResidentPasswordDialog', () => ({
  ResetResidentPasswordDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reset-pwd" /> : null,
}));

import { OverviewTab } from './OverviewTab';

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

  it('investimento NEGOTIATED mostra o valor; oculta vencimento p/ SOCIAL', () => {
    const { rerender } = render(
      <OverviewTab resident={res({ familyInvestment: FamilyInvestment.NEGOTIATED, familyInvestmentAmount: 350 })} />,
    );
    expect(screen.getByText(/R\$ 350/)).toBeInTheDocument();
    expect(screen.getByText('Dia de vencimento da contribuição')).toBeInTheDocument();
    rerender(<OverviewTab resident={res({ familyInvestment: FamilyInvestment.SOCIAL })} />);
    expect(screen.queryByText('Dia de vencimento da contribuição')).not.toBeInTheDocument();
  });

  it('sem acesso digital abre o diálogo de gerar acesso', () => {
    render(<OverviewTab resident={res({ userId: null })} />);
    expect(screen.getByText('Sem acesso gerado.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gerar Acesso/ }));
    expect(screen.getByTestId('gen-access')).toBeInTheDocument();
  });

  it('com acesso digital mostra email e abre reset de senha', () => {
    render(<OverviewTab resident={res({ userId: 'u1', user: { email: 'f@x.com' } } as Partial<Resident>)} />);
    fireEvent.click(screen.getByRole('button', { name: /Resetar Senha/ }));
    expect(screen.getByTestId('reset-pwd')).toBeInTheDocument();
  });
});
