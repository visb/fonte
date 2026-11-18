import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';
import type { Admission } from '@fonte/api-client';

const mutate = vi.fn();
const reset = vi.fn();
let mutationState: { isPending: boolean; isError: boolean; error: unknown } = {
  isPending: false,
  isError: false,
  error: null,
};

vi.mock('../hooks/useResidents', () => ({
  useDeleteAdmission: () => ({ mutate, reset, ...mutationState }),
}));

import { DeleteAdmissionDialog } from './DeleteAdmissionDialog';

const old = {
  id: 'old',
  residentId: 'r1',
  houseId: 'h1',
  house: { id: 'h1', name: 'Casa Belém' },
  status: ResidentStatus.DISCHARGED,
  entryDate: '2020-01-01',
  exitDate: '2020-06-30',
} as Admission;

beforeEach(() => {
  vi.clearAllMocks();
  mutationState = { isPending: false, isError: false, error: null };
});
afterEach(() => cleanup());

describe('DeleteAdmissionDialog', () => {
  it('fechado quando não há passagem', () => {
    render(<DeleteAdmissionDialog residentId="r1" admission={null} onClose={vi.fn()} />);
    expect(screen.queryByText('Excluir acolhimento')).toBeNull();
  });

  it('mostra o período e exclui; sucesso fecha', () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_id, opts) => opts.onSuccess());
    render(<DeleteAdmissionDialog residentId="r1" admission={old} onClose={onClose} />);
    expect(screen.getByText('01/01/2020')).toBeInTheDocument();
    expect(screen.getByText('30/06/2020')).toBeInTheDocument();
    expect(screen.getByText(/Casa Belém/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(mutate.mock.calls[0][0]).toBe('old');
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('erro da API aparece no dialog', () => {
    mutationState = { isPending: false, isError: true, error: new Error('tem parcelas') };
    render(<DeleteAdmissionDialog residentId="r1" admission={old} onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao excluir o acolhimento|tem parcelas/)).toBeInTheDocument();
  });

  it('cancelar reseta e fecha sem excluir', () => {
    const onClose = vi.fn();
    render(<DeleteAdmissionDialog residentId="r1" admission={old} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(mutate).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
