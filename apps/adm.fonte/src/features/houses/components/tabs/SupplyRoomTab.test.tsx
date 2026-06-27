import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MovementType, SupplyRoomCategory } from '@fonte/types';

let itemsState: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };
let movesState: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('../../hooks/useHouses', () => ({
  useHouseSupplyRoomItems: () => itemsState,
  useHouseSupplyRoomMovements: () => movesState,
}));

import { SupplyRoomTab } from './SupplyRoomTab';

beforeEach(() => {
  vi.clearAllMocks();
  itemsState = { data: [], isLoading: false };
  movesState = { data: [], isLoading: false };
});
afterEach(() => cleanup());

describe('SupplyRoomTab', () => {
  it('loading mostra estado de carregamento', () => {
    itemsState = { data: [], isLoading: true };
    render(<SupplyRoomTab houseId="h1" />);
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it('vazio mostra mensagens de itens e movimentações', () => {
    render(<SupplyRoomTab houseId="h1" />);
    expect(screen.getByText('Nenhum item cadastrado.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma movimentação registrada.')).toBeInTheDocument();
  });

  it('renderiza itens com categoria traduzida e quantidade', () => {
    itemsState = {
      data: [{ id: 'i1', name: 'Detergente', category: SupplyRoomCategory.CLEANING, currentQuantity: 5, unit: 'un' }],
      isLoading: false,
    };
    render(<SupplyRoomTab houseId="h1" />);
    expect(screen.getByText('Detergente')).toBeInTheDocument();
    expect(screen.getByText('Limpeza')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renderiza movimentações de entrada (+) e saída (-) com responsável', () => {
    movesState = {
      data: [
        { id: 'm1', type: MovementType.IN, item: { name: 'Sabão', unit: 'un' }, responsible: { name: 'Ana' }, date: '2026-01-10', notes: 'compra', quantity: 3 },
        { id: 'm2', type: MovementType.OUT, item: { name: 'Sabão', unit: 'un' }, responsible: { name: 'Bia' }, date: '2026-01-11', notes: null, quantity: 1 },
      ],
      isLoading: false,
    };
    render(<SupplyRoomTab houseId="h1" />);
    expect(screen.getByText('Ana', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Bia', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/compra/)).toBeInTheDocument();
    // A quantidade é renderizada como sinal + número + <span>unidade</span>;
    // getNodeText concatena só os text nodes diretos do <p> ("+3 " → "+3").
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
  });
});
