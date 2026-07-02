import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Gender, MaritalStatus, Role, ServantRank } from '@fonte/types';
import type { Staff } from '@fonte/api-client';
import { StaffOverviewTab } from './StaffOverviewTab';

afterEach(() => cleanup());

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 's1',
    name: 'Pedro Servo',
    cpf: '12345678901',
    rg: '1234567',
    nationality: 'Brasileiro',
    birthDate: '1990-05-10',
    gender: Gender.MALE,
    phone: '62999998888',
    city: 'Goiânia',
    state: 'GO',
    address: 'Rua A',
    maritalStatus: MaritalStatus.SINGLE,
    children: 0,
    occupation: 'Pedreiro',
    education: 'Médio',
    religion: 'Cristão',
    rank: ServantRank.ASPIRANTE,
    house: { id: 'h1', name: 'Casa Belém' },
    supportGroup: null,
    user: { email: 'pedro@x.com', role: Role.SERVANT },
    formerResidentId: null,
    promotedAt: null,
    ...overrides,
  } as Staff;
}

function renderTab(staff: Staff) {
  return render(
    <MemoryRouter>
      <StaffOverviewTab staff={staff} />
    </MemoryRouter>,
  );
}

describe('StaffOverviewTab', () => {
  it('mostra identificação com CPF/RG mascarados, função e nível', () => {
    renderTab(makeStaff());
    expect(screen.getByText('Pedro Servo')).toBeInTheDocument();
    expect(screen.getByText('Servo')).toBeInTheDocument();
    expect(screen.getByText('Aspirante')).toBeInTheDocument();
    expect(screen.getByText('123.456.789-01')).toBeInTheDocument();
  });

  it('mostra idade calculada junto à data de nascimento', () => {
    renderTab(makeStaff());
    expect(screen.getByText(/anos\)/)).toBeInTheDocument();
  });

  // Story 96 — a ficha do servo não exibe mais campos clínicos/de tratamento.
  it('não mostra campos clínicos/de tratamento', () => {
    renderTab(makeStaff());
    expect(screen.queryByText('Saúde')).not.toBeInTheDocument();
    expect(screen.queryByText('Dependência química')).not.toBeInTheDocument();
    expect(screen.queryByText('Problemas de saúde')).not.toBeInTheDocument();
    expect(screen.queryByText('Medicação contínua')).not.toBeInTheDocument();
    expect(screen.queryByText('Peso')).not.toBeInTheDocument();
    expect(screen.queryByText('Altura')).not.toBeInTheDocument();
  });

  it('seção Origem só aparece quando há formerResidentId, com link de acolhimento', () => {
    const { rerender } = renderTab(makeStaff());
    expect(screen.queryByText('Origem')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <StaffOverviewTab staff={makeStaff({ formerResidentId: 'res1', promotedAt: '2025-01-01' })} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Origem')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver acolhimento/ })).toHaveAttribute('href', '/residents/res1');
  });

  it('campos vazios viram travessão', () => {
    renderTab(makeStaff({ city: null, address: null }));
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
