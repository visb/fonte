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
vi.mock('../../hooks/useHouses', () => ({
  useHouseStaff: () => ({ data: [] }),
  useHouseResidents: () => ({
    data: [
      { id: 'r1', name: 'Filho Ana' },
      { id: 'r2', name: 'Filho Bruno' },
    ],
  }),
}));

import { AddMinistryDialog } from './AddMinistryDialog';

beforeEach(() => {
  vi.clearAllMocks();
  createState = { isPending: false };
});
afterEach(() => cleanup());

describe('AddMinistryDialog', () => {
  it('renderiza título, campo de nome e a lista de filhos', () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByText('Novo ministério')).toBeInTheDocument();
    expect(screen.getByText('Filho Ana')).toBeInTheDocument();
    expect(screen.getByText('Filho Bruno')).toBeInTheDocument();
  });

  it('botão Criar fica desabilitado sem nome', () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled();
  });

  it('filtra filhos pela busca (ignora acentos/caixa)', () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar filho...'), { target: { value: 'bruno' } });
    expect(screen.queryByText('Filho Ana')).not.toBeInTheDocument();
    expect(screen.getByText('Filho Bruno')).toBeInTheDocument();
  });

  it('seleciona filhos e cria com nome + residentIds; fecha no sucesso', async () => {
    const onClose = vi.fn();
    createMutate.mockImplementation((_data, opts) => opts.onSuccess());
    render(<AddMinistryDialog open houseId="h1" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Cozinha' } });
    fireEvent.click(screen.getByText('Filho Ana'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0];
    expect(arg.name).toBe('Cozinha');
    expect(arg.residentIds).toEqual(['r1']);
    expect(arg.leaderId).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('contador de selecionados aparece no label', () => {
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Filho Ana'));
    expect(screen.getByText(/1 selecionados/)).toBeInTheDocument();
  });

  it('pending mostra "Criando..." e desabilita', () => {
    createState = { isPending: true };
    render(<AddMinistryDialog open houseId="h1" onClose={vi.fn()} />);
    // botão de submit fica desabilitado por isPending (mesmo com nome vazio)
    expect(screen.getByRole('button', { name: 'Criando...' })).toBeDisabled();
  });
});
