import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import {
  RESIDENT_ROW_ACTIONS,
  ResidentStatus,
  type ResidentRemovalAction,
  type ResidentRowAction,
} from '@fonte/types';
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
import { removalDefaults } from '../hooks/useResidentRemovalForm';

function resident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: 'r1',
    name: 'Maria Interna',
    houseId: 'h1',
    status: ResidentStatus.ACTIVE,
    ...overrides,
  } as Resident;
}

function open(mode: ResidentRowAction = 'exit', onClose = vi.fn()) {
  return render(<RemoveResidentDialog open onClose={onClose} resident={resident()} mode={mode} />);
}

function chooseAction(action: string) {
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: action } });
}

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false };
});
afterEach(() => cleanup());

// Story 200: cada item do menu cobre uma ação de baixa, sem sobreposição.
describe('RESIDENT_ROW_ACTIONS', () => {
  it('cobre alta, evasão e transferência exatamente uma vez', () => {
    const all = Object.values(RESIDENT_ROW_ACTIONS).flat().sort();
    const expected: ResidentRemovalAction[] = ['discharge', 'evade', 'transfer'];
    expect(all).toEqual(expected);
  });
});

describe('removalDefaults', () => {
  it('exit parte de alta com a data de hoje', () => {
    expect(removalDefaults('exit')).toEqual({
      action: 'discharge',
      exitDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('transfer parte da transferência sem casa escolhida', () => {
    expect(removalDefaults('transfer')).toEqual({ action: 'transfer', targetHouseId: '' });
  });
});

describe('RemoveResidentDialog — mode="exit"', () => {
  it('título é Declarar saída da comunidade e o select só tem alta e evasão', () => {
    open('exit');
    expect(screen.getByText('Declarar saída da comunidade')).toBeInTheDocument();
    expect(screen.getByText('Maria Interna')).toBeInTheDocument();
    expect(screen.queryByText('Remover da casa')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Declarar alta' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Evasão' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Transferir para outra casa' })).not.toBeInTheDocument();
    expect(screen.queryByText('Casa de destino')).not.toBeInTheDocument();
  });

  it('a data é obrigatória: sem ela o submit é bloqueado', async () => {
    open('exit');
    const dateInput = screen.getByPlaceholderText('dd/mm/aaaa') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Informe a data do acontecimento')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('data digitada dd/mm/aaaa vai como YYYY-MM-DD no payload (story 201)', async () => {
    open('exit');
    fireEvent.change(screen.getByPlaceholderText('dd/mm/aaaa'), { target: { value: '23/06/2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toEqual({
      status: ResidentStatus.DISCHARGED,
      exitDate: '2026-06-23',
    });
  });

  it('alta com data muta para DISCHARGED + exitDate e fecha', async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_data, opts) => opts.onSuccess());
    open('exit', onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toEqual({
      status: ResidentStatus.DISCHARGED,
      exitDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('evasão muta para EVADED', async () => {
    open('exit');
    chooseAction('evade');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toMatchObject({ status: ResidentStatus.EVADED });
  });
});

describe('RemoveResidentDialog — mode="transfer"', () => {
  it('título é Transferir de casa, sem select de ação nem data', () => {
    open('transfer');
    expect(screen.getAllByText('Transferir de casa').length).toBeGreaterThan(0);
    expect(screen.queryByText('O que aconteceu?')).not.toBeInTheDocument();
    expect(screen.queryByText('Data do acontecimento')).not.toBeInTheDocument();
    expect(screen.getByText('Casa de destino')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('casa de destino é obrigatória', async () => {
    open('transfer');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Selecione a casa de destino')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('não oferece a casa atual', () => {
    open('transfer');
    expect(screen.getByRole('option', { name: 'Casa Bethel' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Casa Atual' })).not.toBeInTheDocument();
  });

  it('muta só o houseId de destino', async () => {
    open('transfer');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'h2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toEqual({ houseId: 'h2' });
  });
});

describe('RemoveResidentDialog — comum', () => {
  it('cancelar fecha sem mutar', () => {
    const onClose = vi.fn();
    open('exit', onClose);
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
