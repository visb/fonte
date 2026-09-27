import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FamilyInvestment, ResidentStatus, Role } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

// Story 196: o menu `⋮` depende da role de quem está logado.
const auth = { role: Role.ADMIN as Role };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

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
  auth.role = Role.ADMIN;
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

  it('Editar continua botão direto (fora do menu)', () => {
    renderCard(makeResident());
    expect(screen.getByTitle('Editar')).toHaveAttribute('href', '/residents/r1/edit');
  });
});

// Story 196 — o `⋮` com "Remover da casa" + "Excluir".
describe('ResidentCard — menu de ações', () => {
  const MENU = 'Ações de Maria Interna';

  function renderWithMenu(resident: Resident, handlers: { onDelete?: () => void; onRemove?: () => void } = {}) {
    return render(
      <MemoryRouter>
        <ResidentCard
          resident={resident}
          onDelete={handlers.onDelete ?? vi.fn()}
          onRemove={handlers.onRemove ?? vi.fn()}
        />
      </MemoryRouter>,
    );
  }

  it('ADMIN vê Remover da casa e Excluir', async () => {
    const user = userEvent.setup();
    renderWithMenu(makeResident());
    await user.click(screen.getByRole('button', { name: MENU }));
    expect(await screen.findByText('Remover da casa')).toBeInTheDocument();
    expect(screen.getByText('Excluir')).toBeInTheDocument();
    expect(screen.getByTitle('Editar')).toBeInTheDocument();
  });

  it('COORDINATOR vê só Remover da casa (Excluir é ADMIN-only)', async () => {
    auth.role = Role.COORDINATOR;
    const user = userEvent.setup();
    renderWithMenu(makeResident());
    await user.click(screen.getByRole('button', { name: MENU }));
    expect(await screen.findByText('Remover da casa')).toBeInTheDocument();
    expect(screen.queryByText('Excluir')).not.toBeInTheDocument();
  });

  it('escolher Remover da casa dispara onRemove', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    renderWithMenu(makeResident(), { onRemove });
    await user.click(screen.getByRole('button', { name: MENU }));
    await user.click(await screen.findByText('Remover da casa'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('escolher Excluir dispara onDelete (confirmação fica na página)', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderWithMenu(makeResident(), { onDelete });
    await user.click(screen.getByRole('button', { name: MENU }));
    await user.click(await screen.findByText('Excluir'));
    expect(onDelete).toHaveBeenCalled();
  });

  it.each([ResidentStatus.DISCHARGED, ResidentStatus.EVADED, ResidentStatus.ARCHIVED])(
    'filho %s não oferece Remover da casa',
    async (status) => {
      auth.role = Role.COORDINATOR;
      const user = userEvent.setup();
      renderWithMenu(makeResident({ status }));
      // COORDINATOR não pode excluir: sem "Remover", o menu fica vazio e some.
      expect(screen.queryByRole('button', { name: MENU })).not.toBeInTheDocument();
      // ADMIN ainda vê o menu, mas só com Excluir.
      cleanup();
      auth.role = Role.ADMIN;
      renderWithMenu(makeResident({ status }));
      await user.click(screen.getByRole('button', { name: MENU }));
      expect(await screen.findByText('Excluir')).toBeInTheDocument();
      expect(screen.queryByText('Remover da casa')).not.toBeInTheDocument();
    },
  );

  it('sem permissão nenhuma o ⋮ não é renderizado, mas Editar continua', () => {
    auth.role = Role.SERVANT;
    renderWithMenu(makeResident());
    expect(screen.queryByRole('button', { name: MENU })).not.toBeInTheDocument();
    expect(screen.getByTitle('Editar')).toBeInTheDocument();
  });

  it('sem handler de remoção o menu só traz Excluir', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResidentCard resident={makeResident()} onDelete={vi.fn()} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: MENU }));
    expect(await screen.findByText('Excluir')).toBeInTheDocument();
    expect(screen.queryByText('Remover da casa')).not.toBeInTheDocument();
  });
});
