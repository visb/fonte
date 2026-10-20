import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';
import type { Admission } from '@fonte/api-client';
import { AdmissionCard } from './AdmissionCard';

afterEach(() => cleanup());

const admission = (overrides: Partial<Admission> = {}) =>
  ({
    id: 'a1',
    status: ResidentStatus.DISCHARGED,
    houseId: 'h1',
    house: { id: 'h1', name: 'Casa Belém' },
    entryDate: '2020-01-01',
    exitDate: '2020-06-30',
    weight: null,
    height: null,
    ...overrides,
  }) as Admission;

describe('AdmissionCard', () => {
  it('mostra título, status, casa e datas', () => {
    render(<AdmissionCard admission={admission()} title="Acolhimento 1" />);
    expect(screen.getByRole('heading', { name: 'Acolhimento 1' })).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText('01/01/2020')).toBeInTheDocument();
    expect(screen.getByText('30/06/2020')).toBeInTheDocument();
  });

  it('sem onEdit não há botão de editar', () => {
    render(<AdmissionCard admission={admission()} title="Acolhimento 1" />);
    expect(screen.queryByRole('button', { name: 'Editar acolhimento' })).toBeNull();
  });

  it('com onEdit o ícone chama o callback', () => {
    const onEdit = vi.fn();
    render(<AdmissionCard admission={admission()} title="Acolhimento 1" onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar acolhimento' }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('passagem sem casa e status desconhecido caem no fallback', () => {
    render(<AdmissionCard admission={admission({ house: null, houseId: null, status: 'LEGACY', exitDate: null })} title="Acolhimento 1" />);
    expect(screen.getByText('LEGACY')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
