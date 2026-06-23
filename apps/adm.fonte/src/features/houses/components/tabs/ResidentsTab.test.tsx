import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

let residentsResult: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };
let detailResult: { data: unknown } = { data: null };

vi.mock('../../hooks/useHouses', () => ({
  useHouseResidents: () => residentsResult,
}));
vi.mock('@/features/residents/hooks/useResidents', () => ({
  useResidentById: () => detailResult,
}));

import { ResidentsTab } from './ResidentsTab';

const resident = (id: string, name: string) => ({
  id,
  name,
  entryDate: '2026-01-10',
  status: ResidentStatus.ACTIVE,
});

beforeEach(() => {
  vi.clearAllMocks();
  residentsResult = { data: [], isLoading: false };
  detailResult = { data: null };
});
afterEach(() => cleanup());

describe('ResidentsTab', () => {
  it('estado de carregamento', () => {
    residentsResult = { data: [], isLoading: true };
    const { container } = render(<ResidentsTab houseId="h1" />);
    expect(container.querySelector('[class]')).toBeTruthy();
  });

  it('estado vazio', () => {
    render(<ResidentsTab houseId="h1" />);
    expect(screen.getByText('Nenhum filho cadastrado nesta casa.')).toBeInTheDocument();
  });

  it('lista filhos com nome, data de entrada e status', () => {
    residentsResult = { data: [resident('r1', 'Filho A'), resident('r2', 'Filho B')], isLoading: false };
    render(<ResidentsTab houseId="h1" />);
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(screen.getByText('Filho B')).toBeInTheDocument();
    expect(screen.getAllByText('Ativo').length).toBe(2);
  });

  it('abrir detalhe mostra dados e navega para a página completa', () => {
    residentsResult = { data: [resident('r1', 'Filho A')], isLoading: false };
    detailResult = {
      data: {
        id: 'r1',
        name: 'Filho A',
        status: ResidentStatus.ACTIVE,
        entryDate: '2026-01-10',
        birthDate: '2000-01-01',
        cpf: '12345678901',
        rg: null,
        contactPhone: null,
        occupation: null,
        addiction: null,
        healthIssues: null,
        photoUrl: null,
        photoThumbUrl: null,
      },
    };
    render(<ResidentsTab houseId="h1" />);
    fireEvent.click(screen.getByText('Filho A'));
    expect(screen.getByText('Detalhes do Filho')).toBeInTheDocument();
    expect(screen.getByText(/anos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver página completa' }));
    expect(navigate).toHaveBeenCalledWith('/residents/r1');
  });
});
