import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FamilyInvestment, ResidentStatus } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

import { ResidentCard } from './ResidentCard';

function makeResident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: 'r1',
    name: 'Maria Interna',
    photoUrl: null,
    photoThumbUrl: null,
    birthDate: '1990-06-01',
    entryDate: '2026-01-01',
    house: { id: 'h1', name: 'Casa Belém' },
    status: ResidentStatus.ACTIVE,
    familyInvestment: FamilyInvestment.PAYMENT_700,
    lastContributionDate: null,
    contributionDueDay: 10,
    ...overrides,
  } as Resident;
}

function renderCard(resident: Resident) {
  return render(
    <MemoryRouter>
      <ResidentCard resident={resident} onDelete={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

describe('ResidentCard', () => {
  it('mostra nome, casa e idade', () => {
    renderCard(makeResident({ birthDate: '1990-06-01' }));
    expect(screen.getByText('Maria Interna')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText(/anos$/)).toBeInTheDocument();
  });

  it('card é um link para o detalhe', () => {
    renderCard(makeResident());
    expect(screen.getByRole('link', { name: 'Maria Interna' })).toHaveAttribute(
      'href',
      '/residents/r1',
    );
  });

  it('SOCIAL mostra badge Social e nenhum badge de pagamento', () => {
    renderCard(makeResident({ familyInvestment: FamilyInvestment.SOCIAL }));
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.queryByText(/Vence|Atrasado/)).not.toBeInTheDocument();
  });

  it('status não-ativo (alta) não mostra badge de pagamento', () => {
    renderCard(makeResident({ status: ResidentStatus.DISCHARGED }));
    expect(screen.queryByText(/Vence|Atrasado/)).not.toBeInTheDocument();
  });

  it('investimento PAYMENT em status ativo mostra um badge de pagamento que linka ao carnê', () => {
    renderCard(makeResident({ familyInvestment: FamilyInvestment.PAYMENT_700, contributionDueDay: 10 }));
    const badge = screen.getByText(/Vence|Atrasado/);
    expect(badge).toBeInTheDocument();
    expect(badge.closest('a')).toHaveAttribute('href', '/residents/r1?tab=contributions');
  });

  it('sem entryDate não calcula badge de pagamento', () => {
    renderCard(makeResident({ entryDate: null }));
    expect(screen.queryByText(/Vence|Atrasado/)).not.toBeInTheDocument();
  });

  it('link editar e botão excluir', () => {
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <ResidentCard resident={makeResident()} onDelete={onDelete} />
      </MemoryRouter>,
    );
    expect(screen.getByTitle('Editar')).toHaveAttribute('href', '/residents/r1/edit');
    fireEvent.click(screen.getByTitle('Excluir'));
    expect(onDelete).toHaveBeenCalled();
  });
});
