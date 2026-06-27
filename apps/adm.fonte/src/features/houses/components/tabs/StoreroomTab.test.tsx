import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MovementType } from '@fonte/types';

let itemsState: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };
let movesState: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('../../hooks/useHouses', () => ({
  useHouseStoreroomItems: () => itemsState,
  useHouseStoreroomMovements: () => movesState,
}));

import { StoreroomTab } from './StoreroomTab';

beforeEach(() => {
  vi.clearAllMocks();
  itemsState = { data: [], isLoading: false };
  movesState = { data: [], isLoading: false };
});
afterEach(() => cleanup());

describe('StoreroomTab', () => {
  it('loading mostra estado de carregamento', () => {
    movesState = { data: [], isLoading: true };
    render(<StoreroomTab houseId="h1" />);
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it('vazio mostra mensagens de itens e movimentações', () => {
    render(<StoreroomTab houseId="h1" />);
    expect(screen.getByText('Nenhum item cadastrado.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma movimentação registrada.')).toBeInTheDocument();
  });

  it('item com média semanal mostra estimativa; sem média oculta', () => {
    itemsState = {
      data: [
        { id: 'i1', name: 'Arroz', currentQuantity: 20, unit: 'kg', weeklyAverageUsage: 4 },
        { id: 'i2', name: 'Feijão', currentQuantity: 10, unit: 'kg', weeklyAverageUsage: null },
      ],
      isLoading: false,
    };
    render(<StoreroomTab houseId="h1" />);
    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByText('~4.0 kg/sem')).toBeInTheDocument();
    expect(screen.getByText('Feijão')).toBeInTheDocument();
  });

  it('renderiza movimentação com responsável e nota', () => {
    movesState = {
      data: [
        { id: 'm1', type: MovementType.OUT, item: { name: 'Arroz', unit: 'kg' }, responsible: { name: 'Carlos' }, date: '2026-02-01', notes: 'almoço', quantity: 2 },
      ],
      isLoading: false,
    };
    render(<StoreroomTab houseId="h1" />);
    expect(screen.getByText('Carlos', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/almoço/)).toBeInTheDocument();
  });
});
