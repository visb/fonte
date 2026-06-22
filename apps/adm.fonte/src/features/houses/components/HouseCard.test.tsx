import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { House } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

import { HouseCard } from './HouseCard';

function makeHouse(overrides: Partial<House> = {}): House {
  return {
    id: 'h1',
    name: 'Casa Belém',
    thumbnailUrl: null,
    isMotherHouse: false,
    city: 'Goiânia',
    state: 'GO',
    coordinator: { name: 'Coord' },
    phone: '6233334444',
    generalCapacity: 10,
    staffCapacity: 2,
    staffCount: 1,
    activeResidentsCount: 4,
    ...overrides,
  } as House;
}

const noop = () => {};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('HouseCard', () => {
  it('mostra nome, cidade/UF, coordenador, telefone e métricas', () => {
    render(<HouseCard house={makeHouse()} onNavigate={noop} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText('Goiânia — GO')).toBeInTheDocument();
    expect(screen.getByText('Coord')).toBeInTheDocument();
    expect(screen.getByText('6233334444')).toBeInTheDocument();
    // vagas = 10 - 4 - 0 = 6
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('vagas')).toBeInTheDocument();
  });

  it('marca casa mãe e renderiza foto quando há thumbnail', () => {
    render(
      <HouseCard
        house={makeHouse({ isMotherHouse: true, thumbnailUrl: 'http://img/h.jpg' })}
        onNavigate={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('Casa mãe')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'http://img/h.jpg');
  });

  it('sem capacidade não mostra o bloco de métricas', () => {
    render(
      <HouseCard
        house={makeHouse({ generalCapacity: null, staffCapacity: null })}
        onNavigate={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.queryByText('vagas')).not.toBeInTheDocument();
  });

  it('dispara navigate/edit/delete', () => {
    const onNavigate = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<HouseCard house={makeHouse()} onNavigate={onNavigate} onEdit={onEdit} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Casa Belém'));
    expect(onNavigate).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Editar'));
    expect(onEdit).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Excluir'));
    expect(onDelete).toHaveBeenCalled();
  });
});
