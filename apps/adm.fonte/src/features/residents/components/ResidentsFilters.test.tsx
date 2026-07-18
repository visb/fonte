import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }] }),
}));

import { ResidentsFilters } from './ResidentsFilters';

function renderFilters(over: Partial<Parameters<typeof ResidentsFilters>[0]> = {}) {
  const props = {
    search: '', onSearchChange: vi.fn(),
    status: '' as ResidentStatus | '', onStatusChange: vi.fn(),
    houseId: '', onHouseIdChange: vi.fn(),
    overdueContribution: false, onOverdueContributionChange: vi.fn(),
    sort: 'entry_desc' as const, onSortChange: vi.fn(),
    ...over,
  };
  render(<ResidentsFilters {...props} />);
  return props;
}

afterEach(() => cleanup());

describe('ResidentsFilters', () => {
  it('busca propaga o texto', () => {
    const { onSearchChange } = renderFilters();
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: 'João' } });
    expect(onSearchChange).toHaveBeenCalledWith('João');
  });

  it('status propaga o valor', () => {
    const { onStatusChange } = renderFilters();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: ResidentStatus.ACTIVE } });
    expect(onStatusChange).toHaveBeenCalledWith(ResidentStatus.ACTIVE);
  });

  it('casa propaga o id', () => {
    const { onHouseIdChange } = renderFilters();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'h1' } });
    expect(onHouseIdChange).toHaveBeenCalledWith('h1');
  });

  it('botão de contribuição em atraso alterna o filtro', () => {
    const { onOverdueContributionChange } = renderFilters({ overdueContribution: false });
    fireEvent.click(screen.getByRole('button', { name: /Contribuição em atraso/ }));
    expect(onOverdueContributionChange).toHaveBeenCalledWith(true);
  });

  it('ordenação renderiza as 4 opções', () => {
    renderFilters();
    const sortSelect = screen.getByRole('combobox', { name: 'Ordenar por' });
    const values = Array.from(sortSelect.querySelectorAll('option')).map((o) => o.getAttribute('value'));
    expect(values).toEqual(['entry_desc', 'entry_asc', 'name_asc', 'name_desc']);
  });

  it('ordenação propaga o valor escolhido', () => {
    const { onSortChange } = renderFilters();
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar por' }), { target: { value: 'name_asc' } });
    expect(onSortChange).toHaveBeenCalledWith('name_asc');
  });
});
