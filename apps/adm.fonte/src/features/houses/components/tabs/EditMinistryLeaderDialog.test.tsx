import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const mutate = vi.fn();
let mutState = { isPending: false };

vi.mock('../LeaderAutocomplete', () => ({
  LeaderAutocomplete: () => <div data-testid="leader-autocomplete" />,
}));
vi.mock('../../hooks/useHouseMinistries', () => ({
  useUpdateMinistryLeader: () => ({ mutate, ...mutState }),
}));
vi.mock('../../hooks/useHouses', () => ({
  useHouseStaff: () => ({ data: [] }),
  useHouseResidents: () => ({ data: [] }),
}));

import { EditMinistryLeaderDialog } from './EditMinistryLeaderDialog';

const ministry = { id: 'm1', name: 'Cozinha', leaderId: 's1', leaderType: 'STAFF' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mutState = { isPending: false };
});
afterEach(() => cleanup());

describe('EditMinistryLeaderDialog', () => {
  it('não renderiza conteúdo quando ministry é null', () => {
    render(<EditMinistryLeaderDialog ministry={null} houseId="h1" onClose={vi.fn()} />);
    expect(screen.queryByTestId('leader-autocomplete')).not.toBeInTheDocument();
  });

  it('renderiza título com o nome do ministério', () => {
    render(<EditMinistryLeaderDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByText(/Editar Responsável — Cozinha/)).toBeInTheDocument();
    expect(screen.getByTestId('leader-autocomplete')).toBeInTheDocument();
  });

  it('salva chamando mutate com o id do ministério e fecha no sucesso', async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<EditMinistryLeaderDialog ministry={ministry} houseId="h1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0].ministryId).toBe('m1');
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelar dispara onClose', () => {
    const onClose = vi.fn();
    render(<EditMinistryLeaderDialog ministry={ministry} houseId="h1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('botão Salvar desabilitado enquanto pending', () => {
    mutState = { isPending: true };
    render(<EditMinistryLeaderDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });
});
