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
    contributionExempt: false,
    nextDueDate: '2026-01-10',
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

  it('sem parcela em aberto (ex.: mês cancelado) não mostra badge de pagamento', () => {
    renderCard(makeResident({ nextDueDate: null }));
    expect(screen.queryByText(/Vence|Atrasado/)).not.toBeInTheDocument();
  });

  it('isento não mostra badge de pagamento', () => {
    renderCard(makeResident({ contributionExempt: true }));
    expect(screen.queryByText(/Vence|Atrasado/)).not.toBeInTheDocument();
  });

  it('Editar continua botão direto (fora do menu)', () => {
    renderCard(makeResident());
    expect(screen.getByTitle('Editar')).toHaveAttribute('href', '/residents/r1/edit');
  });
});

// Story 206 — layout responsivo: um DOM só para mobile e desktop, botões por último.
describe('ResidentCard — layout responsivo', () => {
  const FOLLOWS = Node.DOCUMENT_POSITION_FOLLOWING;

  it('badges e botões aparecem uma vez só no DOM (sem cópia por breakpoint)', () => {
    renderCard(makeResident({ familyInvestment: FamilyInvestment.PAYMENT_700 }));
    expect(screen.getAllByTestId('resident-card-badges')).toHaveLength(1);
    expect(screen.getAllByTestId('resident-card-actions')).toHaveLength(1);
    expect(screen.getAllByText('Ativo')).toHaveLength(1);
    expect(screen.getAllByText(/Vence|Atrasado/)).toHaveLength(1);
    expect(screen.getAllByTitle('Editar')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Ações de Maria Interna' })).toHaveLength(1);
  });

  it('ordem no DOM: nome → metadados → badges → botões', () => {
    renderCard(makeResident());
    const name = screen.getByText('Maria Interna');
    const meta = screen.getByText('Casa Belém');
    const badges = screen.getByTestId('resident-card-badges');
    const actions = screen.getByTestId('resident-card-actions');
    expect(name.compareDocumentPosition(meta) & FOLLOWS).toBeTruthy();
    expect(meta.compareDocumentPosition(badges) & FOLLOWS).toBeTruthy();
    expect(badges.compareDocumentPosition(actions) & FOLLOWS).toBeTruthy();
    // Nenhum elemento focável depois dos botões dentro do card.
    expect(actions.nextElementSibling).toBeNull();
  });

  it('mobile empilha o conteúdo numa 2ª coluna; desktop (sm) volta a ser linha', () => {
    renderCard(makeResident());
    const card = screen.getByTestId('resident-card');
    expect(card).toHaveClass('items-start', 'sm:items-center');
    const content = screen.getByTestId('resident-card-info').parentElement!;
    expect(content).toHaveClass('flex-col', 'sm:flex-row', 'flex-1', 'min-w-0');
    expect(content.contains(screen.getByTestId('resident-card-badges'))).toBe(true);
    expect(content.contains(screen.getByTestId('resident-card-actions'))).toBe(true);
    expect(screen.getByTestId('resident-card-actions')).toHaveClass('self-end', 'sm:self-auto');
  });

  it('vencimento e editar ficam acima do stretched link (z-10)', () => {
    renderCard(makeResident({ familyInvestment: FamilyInvestment.PAYMENT_700 }));
    const due = screen.getByText(/Vence|Atrasado/).closest('a')!;
    expect(due).toHaveAttribute('href', '/residents/r1?tab=contributions');
    expect(due).toHaveClass('relative', 'z-10');
    const edit = screen.getByTitle('Editar');
    expect(edit).toHaveAttribute('href', '/residents/r1/edit');
    expect(screen.getByTestId('resident-card-actions')).toHaveClass('relative', 'z-10');
    expect(screen.getByRole('link', { name: 'Maria Interna' })).toHaveClass('absolute', 'inset-0');
  });
});

// Story 196/200 — o `⋮` com "Declarar saída da comunidade" + "Transferir de casa" + "Excluir".
describe('ResidentCard — menu de ações', () => {
  const MENU = 'Ações de Maria Interna';
  const EXIT = 'Declarar saída da comunidade';
  const TRANSFER = 'Transferir de casa';

  function renderWithMenu(
    resident: Resident,
    handlers: { onDelete?: () => void; onRemove?: (mode: 'exit' | 'transfer') => void } = {},
  ) {
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

  it('ADMIN vê Declarar saída, Transferir e Excluir', async () => {
    const user = userEvent.setup();
    renderWithMenu(makeResident());
    await user.click(screen.getByRole('button', { name: MENU }));
    expect(await screen.findByText(EXIT)).toBeInTheDocument();
    expect(screen.getByText(TRANSFER)).toBeInTheDocument();
    expect(screen.getByText('Excluir')).toBeInTheDocument();
    expect(screen.queryByText('Remover da casa')).not.toBeInTheDocument();
    expect(screen.getByTitle('Editar')).toBeInTheDocument();
  });

  it('COORDINATOR vê Declarar saída e Transferir (Excluir é ADMIN-only)', async () => {
    auth.role = Role.COORDINATOR;
    const user = userEvent.setup();
    renderWithMenu(makeResident());
    await user.click(screen.getByRole('button', { name: MENU }));
    expect(await screen.findByText(EXIT)).toBeInTheDocument();
    expect(screen.getByText(TRANSFER)).toBeInTheDocument();
    expect(screen.queryByText('Excluir')).not.toBeInTheDocument();
  });

  it.each([
    [EXIT, 'exit'],
    [TRANSFER, 'transfer'],
  ])('escolher %s dispara onRemove com mode %s', async (label, mode) => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    renderWithMenu(makeResident(), { onRemove });
    await user.click(screen.getByRole('button', { name: MENU }));
    await user.click(await screen.findByText(label));
    expect(onRemove).toHaveBeenCalledWith(mode);
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
    'filho %s não oferece saída nem transferência',
    async (status) => {
      auth.role = Role.COORDINATOR;
      const user = userEvent.setup();
      renderWithMenu(makeResident({ status }));
      // COORDINATOR não pode excluir: sem saída/transferência, o menu fica vazio e some.
      expect(screen.queryByRole('button', { name: MENU })).not.toBeInTheDocument();
      // ADMIN ainda vê o menu, mas só com Excluir.
      cleanup();
      auth.role = Role.ADMIN;
      renderWithMenu(makeResident({ status }));
      await user.click(screen.getByRole('button', { name: MENU }));
      expect(await screen.findByText('Excluir')).toBeInTheDocument();
      expect(screen.queryByText(EXIT)).not.toBeInTheDocument();
      expect(screen.queryByText(TRANSFER)).not.toBeInTheDocument();
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
    expect(screen.queryByText(EXIT)).not.toBeInTheDocument();
    expect(screen.queryByText(TRANSFER)).not.toBeInTheDocument();
  });
});
