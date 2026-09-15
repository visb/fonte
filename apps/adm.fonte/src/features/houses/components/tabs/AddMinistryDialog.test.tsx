import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const createMutate = vi.fn();
let createState = { isPending: false };

vi.mock('../LeaderAutocomplete', () => ({
  LeaderAutocomplete: () => <div data-testid="leader-autocomplete" />,
}));
vi.mock('../../hooks/useHouseMinistries', () => ({
  useCreateHouseMinistry: () => ({ mutate: createMutate, ...createState }),
}));
// Story 197: o dialog não busca mais filhos da casa — ministério é coisa de servo.
vi.mock('../../hooks/useHouses', () => ({
  useHouseStaff: () => ({ data: [{ id: 's1', name: 'Servo João' }] }),
}));

import { AddMinistryDialog } from './AddMinistryDialog';

beforeEach(() => {
  vi.clearAllMocks();
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

  // Decisão 1: sem seleção de filhos em lugar nenhum do dialog.
  it('não tem seleção de filhos', () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText('Buscar filho...')).not.toBeInTheDocument();
    expect(screen.queryByText(/Filhos/)).not.toBeInTheDocument();
  });

  it('botão Criar fica desabilitado sem nome', () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled();
  });

  it('cria só com nome e líder; fecha no sucesso', async () => {
    const onClose = vi.fn();
    createMutate.mockImplementation((_data, opts) => opts.onSuccess());
    render(<AddMinistryDialog open houseId="h1" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Cozinha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0];
    expect(arg.name).toBe('Cozinha');
    expect(arg.leaderId).toBeNull();
    expect(arg).not.toHaveProperty('residentIds');
    expect(onClose).toHaveBeenCalled();
  });

  it('pending mostra "Criando..." e desabilita', () => {
    createState = { isPending: true };
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    // botão de submit fica desabilitado por isPending (mesmo com nome vazio)
    expect(screen.getByRole('button', { name: 'Criando...' })).toBeDisabled();
  });
});
