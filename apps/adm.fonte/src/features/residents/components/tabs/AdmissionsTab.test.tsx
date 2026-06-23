import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';

const state = { data: [] as unknown[], isLoading: false };
vi.mock('../../hooks/useResidents', () => ({ useResidentAdmissions: () => state }));

import { AdmissionsTab } from './AdmissionsTab';

beforeEach(() => {
  vi.clearAllMocks();
  state.data = [];
  state.isLoading = false;
});
afterEach(() => cleanup());

describe('AdmissionsTab', () => {
  it('loading mostra carregamento', () => {
    state.isLoading = true;
    const { container } = render(<AdmissionsTab residentId="r1" />);
    expect(container.textContent).toBeTruthy();
  });

  it('vazio mostra mensagem de nenhum acolhimento', () => {
    render(<AdmissionsTab residentId="r1" />);
    expect(screen.getByText('Nenhum acolhimento registrado.')).toBeInTheDocument();
  });

  it('lista acolhimentos numerados em ordem decrescente com casa, datas e status', () => {
    state.data = [
      { id: 'ad2', status: ResidentStatus.ACTIVE, house: { name: 'Casa Belém' }, entryDate: '2026-01-01', exitDate: null, weight: 80, height: 175 },
      { id: 'ad1', status: ResidentStatus.DISCHARGED, house: { name: 'Casa Nazaré' }, entryDate: '2024-01-01', exitDate: '2024-06-01' },
    ];
    render(<AdmissionsTab residentId="r1" />);
    expect(screen.getByText('Acolhimento 2')).toBeInTheDocument();
    expect(screen.getByText('Acolhimento 1')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText('80 kg')).toBeInTheDocument();
    expect(screen.getByText('175 cm')).toBeInTheDocument();
  });
});
