import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { STAFF_DISMISSAL_MESSAGES, type StaffServicePeriod } from '@fonte/types';

const mutate = vi.fn();
const reset = vi.fn();
let state = { isPending: false, isError: false, error: null as unknown };
let periodsData: StaffServicePeriod[] = [];

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }, { id: 'h2', name: 'Casa Nazaré' }] }),
}));
vi.mock('../hooks/useStaff', () => ({
  useStaffServicePeriods: () => ({ data: periodsData }),
  useReinstateStaff: () => ({ mutate, reset, ...state }),
}));

import { ReinstateStaffDialog } from './ReinstateStaffDialog';

const dateInput = () => document.getElementById('reinstate-date') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false, isError: false, error: null };
  periodsData = [
    { id: 'p1', staffId: 's1', houseId: 'h1', startDate: '2024-01-01', endDate: '2025-01-10', createdAt: '', updatedAt: '' },
  ];
});
afterEach(() => cleanup());

describe('ReinstateStaffDialog (story 217)', () => {
  it('pré-seleciona a última casa e reintegra com data e casa escolhidas', async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_payload, opts) => opts.onSuccess());
    render(<ReinstateStaffDialog open onClose={onClose} staffId="s1" houseId="h1" />);
    expect(screen.getByText('Reintegrar servo')).toBeInTheDocument();
    expect((screen.getByLabelText('Casa') as HTMLSelectElement).value).toBe('h1');

    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'h2' } });
    fireEvent.change(dateInput(), { target: { value: '01/02/2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reintegrar' }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toEqual({ date: '2025-02-01', houseId: 'h2' });
    expect(onClose).toHaveBeenCalled();
  });

  it('sem casa manda houseId null', async () => {
    render(<ReinstateStaffDialog open onClose={vi.fn()} staffId="s1" />);
    fireEvent.change(dateInput(), { target: { value: '01/02/2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reintegrar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toEqual({ date: '2025-02-01', houseId: null });
  });

  it('data antes do fim do último período não muta', async () => {
    render(<ReinstateStaffDialog open onClose={vi.fn()} staffId="s1" houseId="h1" />);
    fireEvent.change(dateInput(), { target: { value: '09/01/2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reintegrar' }));
    expect(
      await screen.findByText(STAFF_DISMISSAL_MESSAGES.reinstateBeforeLastEnd('2025-01-10')),
    ).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('erro do backend e estado de envio', () => {
    state = { isPending: true, isError: true, error: new Error('boom') };
    render(<ReinstateStaffDialog open onClose={vi.fn()} staffId="s1" />);
    expect(screen.getByText(/Erro ao reintegrar o servo|boom/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintegrando...' })).toBeDisabled();
  });

  it('cancelar reseta e fecha', () => {
    const onClose = vi.fn();
    render(<ReinstateStaffDialog open onClose={onClose} staffId="s1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
