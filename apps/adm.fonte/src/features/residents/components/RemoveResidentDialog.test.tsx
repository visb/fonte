import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

const mutate = vi.fn();
const reset = vi.fn();
let state = { isPending: false };

vi.mock('../hooks/useResidentRemoval', () => ({
  useRemoveResident: () => ({ mutate, reset, ...state }),
}));

const houses = [
  { id: 'h1', name: 'Casa Atual' },
  { id: 'h2', name: 'Casa Bethel' },
];
vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: houses }),
}));

import { RemoveResidentDialog } from './RemoveResidentDialog';

function resident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: 'r1',
    name: 'Maria Interna',
    houseId: 'h1',
    status: ResidentStatus.ACTIVE,
    ...overrides,
  } as Resident;
}

function open() {
  return render(<RemoveResidentDialog open onClose={vi.fn()} resident={resident()} />);
}

function chooseAction(action: string) {
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: action } });
}

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false };
});
afterEach(() => cleanup());

describe('RemoveResidentDialog', () => {
  it('abre com as três ações e o nome do filho', () => {
    open();
    expect(screen.getByText('Maria Interna')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Declarar alta' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Evasão' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Transferir para outra casa' })).toBeInTheDocument();
  });

  it('alta exige data: sem ela o submit é bloqueado', async () => {
    open();
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    fireEvent.change(dateInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Informe a data do acontecimento')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('alta com data muta para DISCHARGED e fecha', async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_data, opts) => opts.onSuccess());
    render(<RemoveResidentDialog open onClose={onClose} resident={resident()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toEqual({
      status: ResidentStatus.DISCHARGED,
      exitDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('evasão muta para EVADED', async () => {
    open();
    chooseAction('evade');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toMatchObject({ status: ResidentStatus.EVADED });
  });

  it('transferência não pede data e exige casa de destino', async () => {
    open();
    chooseAction('transfer');
    expect(screen.queryByText('Data do acontecimento')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Selecione a casa de destino')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('transferência não oferece a casa atual', () => {
    open();
    chooseAction('transfer');
    expect(screen.getByRole('option', { name: 'Casa Bethel' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Casa Atual' })).not.toBeInTheDocument();
  });

  it('transferência muta só o houseId de destino', async () => {
    open();
    chooseAction('transfer');
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toEqual({ houseId: 'h2' });
  });

  it('cancelar fecha sem mutar', () => {
    const onClose = vi.fn();
    render(<RemoveResidentDialog open onClose={onClose} resident={resident()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('enquanto salva, os botões ficam desabilitados', () => {
    state = { isPending: true };
    open();
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});
