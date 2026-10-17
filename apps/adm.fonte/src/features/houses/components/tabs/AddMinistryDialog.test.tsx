import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const createMutate = vi.fn();
let createState = { isPending: false };
const leaderProps: Record<string, unknown>[] = [];
const eligibleCalls: unknown[][] = [];

vi.mock('../LeaderAutocomplete', () => ({
  LeaderAutocomplete: (props: Record<string, unknown>) => {
    leaderProps.push(props);
    return <div data-testid="leader-autocomplete" />;
  },
}));
vi.mock('../../hooks/useHouseMinistries', () => ({
  useCreateHouseMinistry: () => ({ mutate: createMutate, ...createState }),
  // O hook real já devolve só os filhos em acolhimento (filtro no `select`).
  useMinistryEligibleResidents: (...args: unknown[]) => {
    eligibleCalls.push(args);
    return { data: [{ id: 'r1', name: 'Filho Ana', status: 'ACTIVE' }] };
  },
}));
vi.mock('../../hooks/useHouses', () => ({
  useHouseStaff: () => ({ data: [{ id: 's1', name: 'Servo João' }] }),
}));

import { AddMinistryDialog } from './AddMinistryDialog';

beforeEach(() => {
  vi.clearAllMocks();
  leaderProps.length = 0;
  eligibleCalls.length = 0;
  createState = { isPending: false };
});
afterEach(() => cleanup());

describe('AddMinistryDialog', () => {
  it('renderiza título, campo de nome e o seletor de líder', () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByText('Novo ministério')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome *')).toBeInTheDocument();
    expect(screen.getByTestId('leader-autocomplete')).toBeInTheDocument();
  });

  // Story 205: filho em acolhimento da casa volta como opção de líder.
  it('oferece servos e filhos elegíveis da casa ao seletor de líder', () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    const props = leaderProps.at(-1)!;
    expect(props.staff).toEqual([{ id: 's1', name: 'Servo João' }]);
    expect(props.residents).toEqual([{ id: 'r1', name: 'Filho Ana', status: 'ACTIVE' }]);
    expect(eligibleCalls.at(-1)).toEqual(['h1', { enabled: true }]);
  });

  it('membros filhos entram depois: o dialog só avisa', () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText('Buscar filho...')).not.toBeInTheDocument();
    expect(screen.getByText(/adicionados depois, em "Filhos"/)).toBeInTheDocument();
  });

  it('botão Criar fica desabilitado sem nome', () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled();
  });

  it('cria com nome e líder filho; fecha no sucesso', async () => {
    const onClose = vi.fn();
    createMutate.mockImplementation((_data, opts) => opts.onSuccess());
    render(<AddMinistryDialog open houseId="h1" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Cozinha' } });
    const onSelect = leaderProps.at(-1)!.onSelect as (id: string | null, type: string | null) => void;
    await waitFor(() => onSelect('r1', 'RESIDENT'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0];
    expect(arg).toEqual({ name: 'Cozinha', leaderId: 'r1', leaderType: 'RESIDENT' });
    expect(onClose).toHaveBeenCalled();
  });

  it('cria sem líder quando nada foi escolhido', async () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Horta' } });
    fireEvent.keyDown(screen.getByLabelText('Nome *'), { key: 'Enter' });
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toMatchObject({ leaderId: null, leaderType: null });
  });

  it('pending mostra "Criando..." e desabilita', () => {
    createState = { isPending: true };
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Criando...' })).toBeDisabled();
  });
});
