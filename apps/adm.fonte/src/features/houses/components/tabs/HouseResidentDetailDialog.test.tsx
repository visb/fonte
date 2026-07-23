import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

let detailResult: { data: unknown } = { data: null };
vi.mock('@/features/residents/hooks/useResidents', () => ({
  useResidentById: () => detailResult,
}));

import { HouseResidentDetailDialog } from './HouseResidentDetailDialog';

const fullDetail = {
  id: 'r1',
  name: 'Filho A',
  status: ResidentStatus.ACTIVE,
  entryDate: '2026-01-10',
  birthDate: '2000-01-01',
  cpf: '12345678901',
  rg: '9876543',
  contactPhone: '11999999999',
  occupation: 'Pedreiro',
  addiction: 'Álcool',
  healthIssues: 'Hipertensão',
  photoUrl: 'photo.jpg',
  photoThumbUrl: 'thumb.jpg',
};

beforeEach(() => {
  vi.clearAllMocks();
  detailResult = { data: null };
});
afterEach(() => cleanup());

describe('HouseResidentDetailDialog', () => {
  it('fechado (residentId null) não renderiza o conteúdo', () => {
    render(<HouseResidentDetailDialog residentId={null} onClose={vi.fn()} />);
    expect(screen.queryByText('Detalhes do Filho')).not.toBeInTheDocument();
  });

  it('aberto sem detalhe carregado mostra LoadingState', () => {
    render(<HouseResidentDetailDialog residentId="r1" onClose={vi.fn()} />);
    expect(screen.getByText('Detalhes do Filho')).toBeInTheDocument();
    // sem detalhe → nenhum campo de dados renderizado ainda.
    expect(screen.queryByText('Entrada')).not.toBeInTheDocument();
  });

  it('renderiza foto, dependência, saúde e idade quando há detalhe completo', () => {
    detailResult = { data: fullDetail };
    render(<HouseResidentDetailDialog residentId="r1" onClose={vi.fn()} />);

    const img = screen.getByRole('img', { name: 'Filho A' }) as HTMLImageElement;
    expect(img.src).toContain('thumb.jpg');
    expect(screen.getByText('Álcool')).toBeInTheDocument();
    expect(screen.getByText('Hipertensão')).toBeInTheDocument();
    expect(screen.getByText(/anos/)).toBeInTheDocument();
    expect(screen.getByText('12345678901')).toBeInTheDocument();
  });

  it('sem foto e sem data de nascimento usa placeholder e idade "—"', () => {
    detailResult = {
      data: {
        ...fullDetail,
        photoUrl: null,
        photoThumbUrl: null,
        birthDate: null,
        cpf: null,
        rg: null,
        contactPhone: null,
        occupation: null,
        addiction: null,
        healthIssues: null,
      },
    };
    render(<HouseResidentDetailDialog residentId="r1" onClose={vi.fn()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // idade "—" aparece na grade de dados.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('Dependência')).not.toBeInTheDocument();
    expect(screen.queryByText('Saúde')).not.toBeInTheDocument();
  });

  it('"Ver página completa" fecha e navega', () => {
    detailResult = { data: fullDetail };
    const onClose = vi.fn();
    render(<HouseResidentDetailDialog residentId="r1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver página completa' }));
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/residents/r1');
  });
});
