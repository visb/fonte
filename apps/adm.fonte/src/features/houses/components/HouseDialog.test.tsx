import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { House } from '@fonte/api-client';

const createMutate = vi.fn();
const updateMutate = vi.fn();
let createState = { isPending: false };
let updateState = { isPending: false };

vi.mock('../hooks/useHouses', () => ({
  useCreateHouse: () => ({ mutate: createMutate, ...createState }),
  useUpdateHouse: () => ({ mutate: updateMutate, ...updateState }),
}));
vi.mock('@/features/staff/hooks/useStaff', () => ({
  useStaff: () => ({ data: [{ id: 'c1', name: 'Coord Um' }] }),
}));

import { HouseDialog } from './HouseDialog';

function makeHouse(overrides: Partial<House> = {}): House {
  return {
    id: 'h1',
    name: 'Casa Belém',
    generalCapacity: 10,
    staffCapacity: 2,
    address: 'Rua A',
    city: 'Goiânia',
    state: 'GO',
    coordinatorId: '',
    phone: '6233334444',
    isMotherHouse: false,
    ...overrides,
  } as House;
}

beforeEach(() => {
  vi.clearAllMocks();
  createState = { isPending: false };
  updateState = { isPending: false };
});
afterEach(() => cleanup());

describe('HouseDialog', () => {
  it('título "Nova Casa" no modo criação', () => {
    render(<HouseDialog open house={null} onClose={vi.fn()} />);
    expect(screen.getByText('Nova Casa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
  });

  it('título "Editar Casa" e nome preenchido no modo edição', () => {
    render(<HouseDialog open house={makeHouse()} onClose={vi.fn()} />);
    expect(screen.getByText('Editar Casa')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Casa Belém')).toBeInTheDocument();
  });

  it('cria casa com payload sanitizado e fecha no sucesso', async () => {
    const onClose = vi.fn();
    createMutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<HouseDialog open house={null} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Casa Nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const payload = createMutate.mock.calls[0][0];
    expect(payload.name).toBe('Casa Nova');
    // capacidades vazias viram null pela sanitização
    expect(payload.generalCapacity).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('edita casa chamando updateMutation', async () => {
    const onClose = vi.fn();
    updateMutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<HouseDialog open house={makeHouse()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(createMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelar dispara onClose', () => {
    const onClose = vi.fn();
    render(<HouseDialog open house={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('botão desabilitado enquanto pending', () => {
    createState = { isPending: true };
    render(<HouseDialog open house={null} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled();
  });
});
