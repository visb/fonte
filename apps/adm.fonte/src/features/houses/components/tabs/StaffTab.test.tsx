import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const navigate = vi.fn();
let staffState: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../hooks/useHouses', () => ({
  useHouseStaff: () => staffState,
}));

import { StaffTab } from './StaffTab';

beforeEach(() => {
  vi.clearAllMocks();
  staffState = { data: [], isLoading: false };
});
afterEach(() => cleanup());

describe('StaffTab', () => {
  it('loading mostra carregamento', () => {
    staffState = { data: [], isLoading: true };
    render(<StaffTab houseId="h1" />);
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it('vazio mostra mensagem', () => {
    render(<StaffTab houseId="h1" />);
    expect(screen.getByText('Nenhum servo cadastrado nesta casa.')).toBeInTheDocument();
  });

  it('lista servos com whatsapp mascarado e navega para edição', () => {
    staffState = {
      data: [
        { id: 's1', name: 'João', whatsapp: '62999990000' },
        { id: 's2', name: 'Maria', whatsapp: null },
      ],
      isLoading: false,
    };
    render(<StaffTab houseId="h1" />);
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByText('(62) 99999-0000')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTitle('Editar servo')[0]);
    expect(navigate).toHaveBeenCalledWith('/staff/s1/edit');
  });
});
