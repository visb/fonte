import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { STAFF_DISMISSAL_MESSAGES, StaffDismissalReason, type StaffServicePeriod } from '@fonte/types';

const mutate = vi.fn();
const reset = vi.fn();
let state = { isPending: false, isError: false, error: null as unknown };
let periodsData: StaffServicePeriod[] = [];

vi.mock('../hooks/useStaff', () => ({
  useStaffServicePeriods: () => ({ data: periodsData }),
  useDismissStaff: () => ({ mutate, reset, ...state }),
}));

import { DismissStaffDialog } from './DismissStaffDialog';

const dateInput = () => document.getElementById('dismiss-date') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false, isError: false, error: null };
  periodsData = [
    { id: 'p1', staffId: 's1', houseId: 'h1', startDate: '2024-01-01', endDate: null, createdAt: '', updatedAt: '' },
  ];
});
afterEach(() => cleanup());

function renderDialog(onClose = vi.fn()) {
  render(<DismissStaffDialog open onClose={onClose} staffId="s1" staffName="Pedro Servo" />);
  return onClose;
}

describe('DismissStaffDialog (story 217)', () => {
  it('desliga com data, motivo e observação aparada e fecha', async () => {
    mutate.mockImplementation((_payload, opts) => opts.onSuccess());
    const onClose = renderDialog();
    expect(screen.getByText('Desligar servo')).toBeInTheDocument();
    expect(screen.getByText('Pedro Servo')).toBeInTheDocument();

    fireEvent.change(dateInput(), { target: { value: '10/01/2025' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: StaffDismissalReason.DEATH } });
    fireEvent.change(screen.getByLabelText('Observação'), { target: { value: '  em paz  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toEqual({
      date: '2025-01-10',
      reason: StaffDismissalReason.DEATH,
      notes: 'em paz',
    });
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('sem motivo não muta', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }));
    expect(await screen.findByText('Selecione o motivo.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('"Outro" exige observação (rótulo vira obrigatório)', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: StaffDismissalReason.OTHER } });
    expect(await screen.findByText('Observação *')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }));
    expect(await screen.findByText(STAFF_DISMISSAL_MESSAGES.notesRequired)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('data anterior ao início do período em andamento', async () => {
    renderDialog();
    fireEvent.change(dateInput(), { target: { value: '31/12/2023' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: StaffDismissalReason.OWN_REQUEST } });
    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }));
    expect(await screen.findByText(STAFF_DISMISSAL_MESSAGES.dateBeforeStart('2024-01-01'))).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('mostra o erro do backend e o estado de envio', () => {
    state = { isPending: true, isError: true, error: new Error('boom') };
    renderDialog();
    expect(screen.getByText(/Erro ao desligar o servo|boom/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desligando...' })).toBeDisabled();
  });

  it('cancelar reseta e fecha', () => {
    const onClose = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
