import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }] }),
}));

import { StaffFilters } from './StaffFilters';

function renderFilters(over: Partial<Parameters<typeof StaffFilters>[0]> = {}) {
  const props = {
    search: '',
    onSearchChange: vi.fn(),
    status: 'active' as const,
    onStatusChange: vi.fn(),
    houseId: '',
    onHouseIdChange: vi.fn(),
    showHouseFilter: true,
    ...over,
  };
  render(<StaffFilters {...props} />);
  return props;
}

afterEach(() => cleanup());

describe('StaffFilters (story 223)', () => {
  it('busca propaga o texto', () => {
    const { onSearchChange } = renderFilters();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar servos' }), { target: { value: 'Ana' } });
    expect(onSearchChange).toHaveBeenCalledWith('Ana');
  });

  it('status propaga Desligados', () => {
    const { onStatusChange } = renderFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Desligados' }));
    expect(onStatusChange).toHaveBeenCalledWith('dismissed');
  });

  it('ADMIN vê o seletor de casa e a escolha propaga o id', () => {
    const { onHouseIdChange } = renderFilters({ houseId: '' });
    const select = screen.getByRole('combobox', { name: 'Casa' });
    expect(screen.getByRole('option', { name: 'Todas as casas' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'h1' } });
    expect(onHouseIdChange).toHaveBeenCalledWith('h1');
  });

  it('sem permissão de casa o seletor não aparece', () => {
    renderFilters({ showHouseFilter: false });
    expect(screen.queryByRole('combobox', { name: 'Casa' })).toBeNull();
  });
});
