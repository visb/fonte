import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const mutate = vi.fn();
let mutState: { isPending: boolean; isError?: boolean; error?: unknown } = { isPending: false };

const leaderProps: Record<string, unknown>[] = [];

vi.mock('../LeaderAutocomplete', () => ({
  LeaderAutocomplete: (props: Record<string, unknown>) => {
    leaderProps.push(props);
    return <div data-testid="leader-autocomplete" />;
  },
}));
vi.mock('../../hooks/useHouseMinistries', () => ({
  useUpdateMinistryLeader: () => ({ mutate, ...mutState }),
  useMinistryEligibleResidents: () => ({ data: [{ id: 'r1', name: 'Filho Ana', status: 'ACTIVE' }] }),
}));
vi.mock('../../hooks/useHouses', () => ({
  useHouseStaff: () => ({ data: [{ id: 's1', name: 'Servo João' }] }),
}));

import { EditMinistryLeaderDialog } from './EditMinistryLeaderDialog';

const ministry = { id: 'm1', name: 'Cozinha', leaderId: 's1', leaderType: 'STAFF' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  leaderProps.length = 0;
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
    expect(mutate.mock.calls[0][0]).toMatchObject({ ministryId: 'm1', leaderId: 's1', leaderType: 'STAFF' });
    expect(onClose).toHaveBeenCalled();
  });

  // Story 205: filho em acolhimento volta a poder liderar.
  it('oferece servos e filhos elegíveis ao autocomplete e preserva o tipo do líder', () => {
    render(
      <EditMinistryLeaderDialog
        ministry={{ id: 'm1', name: 'Cozinha', leaderId: 'r1', leaderType: 'RESIDENT' } as never}
        houseId="h1"
        onClose={vi.fn()}
      />,
    );
    const props = leaderProps.at(-1)!;
    expect(props.staff).toEqual([{ id: 's1', name: 'Servo João' }]);
    expect(props.residents).toEqual([{ id: 'r1', name: 'Filho Ana', status: 'ACTIVE' }]);
    expect(props.selectedType).toBe('RESIDENT');
  });

  it('erro do backend (400 de filho fora de acolhimento) aparece no dialog', () => {
    mutState = {
      isPending: false,
      isError: true,
      error: { response: { data: { message: 'Só filho em acolhimento nesta casa pode participar do ministério.' } } },
    };
    render(<EditMinistryLeaderDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByText(/Só filho em acolhimento nesta casa/)).toBeInTheDocument();
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
