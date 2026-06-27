import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Um' }, { id: 'h2', name: 'Casa Dois' }] }),
}));
vi.mock('@/features/staff/hooks/useStaff', () => ({
  useStaff: () => ({ data: [{ id: 's1', name: 'Servo Um' }] }),
}));

import { ActivityFilters } from './ActivityFilters';

afterEach(() => cleanup());

describe('ActivityFilters', () => {
  it('com showHouseFilter mostra filtro de Casa e emite houseId', () => {
    const onChange = vi.fn();
    render(<ActivityFilters filters={{}} onChange={onChange} showHouseFilter />);
    const houseSelect = screen.getByLabelText('Casa');
    expect(houseSelect).toBeInTheDocument();
    fireEvent.change(houseSelect, { target: { value: 'h2' } });
    expect(onChange).toHaveBeenCalledWith({ houseId: 'h2' });
  });

  it('sem showHouseFilter oculta o filtro de Casa', () => {
    render(<ActivityFilters filters={{}} onChange={vi.fn()} showHouseFilter={false} />);
    expect(screen.queryByLabelText('Casa')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Responsável')).toBeInTheDocument();
  });

  it('responsável vazio vira undefined', () => {
    const onChange = vi.fn();
    render(<ActivityFilters filters={{ responsibleStaffId: 's1' }} onChange={onChange} showHouseFilter={false} />);
    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ responsibleStaffId: undefined });
  });

  it('preserva filtros existentes ao alterar responsável', () => {
    const onChange = vi.fn();
    render(<ActivityFilters filters={{ houseId: 'h1' }} onChange={onChange} showHouseFilter />);
    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: 's1' } });
    expect(onChange).toHaveBeenCalledWith({ houseId: 'h1', responsibleStaffId: 's1' });
  });
});
