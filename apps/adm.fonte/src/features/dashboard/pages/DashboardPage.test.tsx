import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { House } from '@fonte/api-client';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: vi.fn(),
}));

import { useHouses } from '@/features/houses/hooks/useHouses';
import { DashboardPage } from './DashboardPage';

function house(overrides: Partial<House> = {}): House {
  return {
    id: 'h1',
    name: 'Casa Belém',
    generalCapacity: 10,
    staffCapacity: 2,
    activeResidentsCount: 4,
    staffCount: 2,
    ...overrides,
  } as House;
}

const mocked = vi.mocked(useHouses);

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  it('exibe o título e a ação de novo acolhimento', () => {
    mocked.mockReturnValue({ data: [] } as ReturnType<typeof useHouses>);
    renderPage();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Novo acolhimento/ })).toBeInTheDocument();
  });

  it('não renderiza a seção de ocupação quando não há casas', () => {
    mocked.mockReturnValue({ data: [] } as ReturnType<typeof useHouses>);
    renderPage();
    expect(screen.queryByText('Ocupação das Casas')).not.toBeInTheDocument();
  });

  it('renderiza os cards das casas num grid auto-fill sem scroll horizontal', () => {
    const houses = [
      house({ id: 'h1', name: 'Casa Um' }),
      house({ id: 'h2', name: 'Casa Dois' }),
      house({ id: 'h3', name: 'Casa Três' }),
    ];
    mocked.mockReturnValue({ data: houses } as ReturnType<typeof useHouses>);
    renderPage();

    expect(screen.getByText('Ocupação das Casas')).toBeInTheDocument();
    expect(screen.getByText('Casa Um')).toBeInTheDocument();
    expect(screen.getByText('Casa Dois')).toBeInTheDocument();
    expect(screen.getByText('Casa Três')).toBeInTheDocument();

    const grid = screen.getByText('Casa Um').closest('div.grid');
    expect(grid).not.toBeNull();
    // grid responsivo por largura mínima — sem scroll horizontal
    expect(grid).not.toHaveClass('overflow-x-auto');
    expect(grid?.getAttribute('style')).toContain('repeat(auto-fill, minmax(10rem, 1fr))');
  });
});
