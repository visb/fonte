import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const addMutate = vi.fn();
const removeMutate = vi.fn();
const toastError = vi.fn();
let detailState: { data?: unknown; isLoading: boolean; error: unknown } = { isLoading: false, error: null };
let pending = false;

vi.mock('@/lib/toast', () => ({ toastError: (...args: unknown[]) => toastError(...args) }));
vi.mock('../../hooks/useHouseMinistries', () => ({
  useMinistryDetail: () => detailState,
  // O hook real devolve só filhos em acolhimento — o filho com alta não chega aqui.
  useMinistryEligibleResidents: () => ({
    data: [
      { id: 'r1', name: 'Ana Ativa', status: 'ACTIVE' },
      { id: 'r2', name: 'Bruno Disciplina', status: 'DISCIPLINE' },
    ],
  }),
  useAddMinistryResident: () => ({ mutate: addMutate, isPending: pending }),
  useRemoveMinistryResident: () => ({ mutate: removeMutate, isPending: false }),
}));

import { MinistryResidentsDialog } from './MinistryResidentsDialog';

const ministry = { id: 'm1', name: 'Cozinha' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  pending = false;
  detailState = {
    isLoading: false,
    error: null,
    data: {
      members: [
        { id: 'r1', name: 'Ana Ativa', role: 'FILHO' },
        { id: 's1', name: 'Servo João', role: 'SERVO' },
      ],
    },
  };
});
afterEach(() => cleanup());

describe('MinistryResidentsDialog (story 205)', () => {
  it('fechado quando ministry é null', () => {
    render(<MinistryResidentsDialog ministry={null} houseId="h1" onClose={vi.fn()} />);
    expect(screen.queryByText(/Filhos —/)).not.toBeInTheDocument();
  });

  it('lista só os membros filhos e permite remover', () => {
    render(<MinistryResidentsDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByText('Filhos — Cozinha')).toBeInTheDocument();
    expect(screen.getByText('Filhos (1)')).toBeInTheDocument();
    expect(screen.queryByText('Servo João')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover Ana Ativa' }));
    expect(removeMutate).toHaveBeenCalledWith('r1', expect.objectContaining({ onError: expect.any(Function) }));
  });

  it('a busca oferece só filhos elegíveis que ainda não são membros', () => {
    render(<MinistryResidentsDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Adicionar Ana Ativa' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Bruno Disciplina' }));
    expect(addMutate).toHaveBeenCalledWith('r2', expect.objectContaining({ onError: expect.any(Function) }));
  });

  it('busca filtra ignorando acento e mostra vazio quando nada casa', () => {
    render(<MinistryResidentsDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar filho...'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhum filho em acolhimento para adicionar.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar filho...'), { target: { value: 'bruno' } });
    expect(screen.getByText('Bruno Disciplina')).toBeInTheDocument();
  });

  it('erro da API vira toast com a mensagem', () => {
    addMutate.mockImplementation((_id, opts) => opts.onError(new Error('400')));
    render(<MinistryResidentsDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Bruno Disciplina' }));
    expect(toastError).toHaveBeenCalledWith(expect.any(Error), 'Erro ao atualizar os filhos do ministério');
  });

  it('ministério sem filhos mostra aviso', () => {
    detailState = { isLoading: false, error: null, data: { members: [] } };
    render(<MinistryResidentsDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByText('Nenhum filho neste ministério.')).toBeInTheDocument();
  });

  it('enquanto grava, os botões ficam desabilitados', () => {
    pending = true;
    render(<MinistryResidentsDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Adicionar Bruno Disciplina' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remover Ana Ativa' })).toBeDisabled();
  });

  it('loading e erro usam os componentes de estado', () => {
    detailState = { isLoading: true, error: null };
    const { unmount } = render(<MinistryResidentsDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
    unmount();
    detailState = { isLoading: false, error: new Error('x') };
    render(<MinistryResidentsDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao carregar o ministério|x/)).toBeInTheDocument();
  });

  it('Fechar dispara onClose', () => {
    const onClose = vi.fn();
    render(<MinistryResidentsDialog ministry={ministry} houseId="h1" onClose={onClose} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar' })[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
