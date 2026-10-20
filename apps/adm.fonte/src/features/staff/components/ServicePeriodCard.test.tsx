import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { StaffServicePeriod } from '@fonte/types';
import { ServicePeriodCard } from './ServicePeriodCard';

afterEach(() => cleanup());

const base: StaffServicePeriod = {
  id: 'p1',
  staffId: 's1',
  houseId: 'h1',
  house: { id: 'h1', name: 'Casa Belém' },
  startDate: '2025-03-01',
  endDate: null,
  createdAt: '',
  updatedAt: '',
};

describe('ServicePeriodCard', () => {
  it('período aberto: rótulo, casa, início e "Em andamento"', () => {
    render(<ServicePeriodCard period={base} />);
    expect(screen.getByText('Período de serviço')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText('01/03/2025')).toBeInTheDocument();
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByText('Atual')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar período de serviço' })).toBeNull();
  });

  it('período encerrado mostra o fim; sem casa mostra "Sem casa"', () => {
    render(<ServicePeriodCard period={{ ...base, house: null, houseId: null, endDate: '2025-06-30' }} />);
    expect(screen.getByText('30/06/2025')).toBeInTheDocument();
    expect(screen.getByText('Encerrado')).toBeInTheDocument();
    expect(screen.getByText('Sem casa')).toBeInTheDocument();
  });

  it('casa sem relação carregada cai no id', () => {
    render(<ServicePeriodCard period={{ ...base, house: undefined }} />);
    expect(screen.getByText('h1')).toBeInTheDocument();
  });

  it('onEdit mostra o botão e dispara', () => {
    const onEdit = vi.fn();
    render(<ServicePeriodCard period={base} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar período de serviço' }));
    expect(onEdit).toHaveBeenCalled();
  });
});
