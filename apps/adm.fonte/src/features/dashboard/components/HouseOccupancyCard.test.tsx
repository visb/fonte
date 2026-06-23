import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { House } from '@fonte/api-client';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import { HouseOccupancyCard } from './HouseOccupancyCard';

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

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

function renderCard(h: House) {
  return render(
    <MemoryRouter>
      <HouseOccupancyCard house={h} />
    </MemoryRouter>,
  );
}

describe('HouseOccupancyCard', () => {
  it('mostra nome, vagas calculadas, filhos e servos', () => {
    renderCard(house());
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    // 10 - 4 ativos - 0 overflow = 6 vagas
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // filhos
  });

  it('mostra travessão quando casa sem capacidade definida', () => {
    renderCard(house({ generalCapacity: null, staffCapacity: null }));
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('navega para o detalhe da casa ao clicar', () => {
    renderCard(house());
    fireEvent.click(screen.getByText('Casa Belém'));
    expect(navigate).toHaveBeenCalledWith('/houses/h1');
  });
});
