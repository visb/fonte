import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

let listState: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('../../hooks/useHouseMinistries', () => ({
  useHouseMinistriesList: () => listState,
}));
vi.mock('./AddMinistryDialog', () => ({
  AddMinistryDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-ministry" /> : null,
}));
vi.mock('./EditMinistryLeaderDialog', () => ({
  EditMinistryLeaderDialog: ({ ministry }: { ministry: unknown }) =>
    ministry ? <div data-testid="edit-ministry" /> : null,
}));
vi.mock('./RemoveMinistryDialog', () => ({
  RemoveMinistryDialog: ({ ministry }: { ministry: unknown }) =>
    ministry ? <div data-testid="remove-ministry" /> : null,
}));

import { MinistriesTab } from './MinistriesTab';

beforeEach(() => {
  vi.clearAllMocks();
  listState = { data: [], isLoading: false };
});
afterEach(() => cleanup());

describe('MinistriesTab', () => {
  it('loading mostra carregamento', () => {
    listState = { data: [], isLoading: true };
    render(<MinistriesTab houseId="h1" />);
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it('vazio mostra mensagem', () => {
    render(<MinistriesTab houseId="h1" />);
    expect(screen.getByText('Nenhum ministério cadastrado para esta casa.')).toBeInTheDocument();
  });

  it('lista ministérios com responsável e contagens singular/plural', () => {
    listState = {
      data: [
        { id: 'm1', name: 'Cozinha', leaderName: 'João', filhoCount: 1, servoCount: 2 },
        { id: 'm2', name: 'Limpeza', leaderName: null, filhoCount: 0, servoCount: 1 },
      ],
      isLoading: false,
    };
    render(<MinistriesTab houseId="h1" />);
    expect(screen.getByText('Cozinha')).toBeInTheDocument();
    expect(screen.getByText(/Responsável: João/)).toBeInTheDocument();
    expect(screen.getByText(/1 filho/)).toBeInTheDocument();
    expect(screen.getByText(/2 servos/)).toBeInTheDocument();
    expect(screen.getByText(/Responsável: Não definido/)).toBeInTheDocument();
    expect(screen.getByText(/1 servo(?!s)/)).toBeInTheDocument();
  });

  it('abre dialog de novo ministério', () => {
    render(<MinistriesTab houseId="h1" />);
    fireEvent.click(screen.getByRole('button', { name: /Novo ministério/ }));
    expect(screen.getByTestId('add-ministry')).toBeInTheDocument();
  });

  it('abre editar e remover responsável de um ministério', () => {
    listState = {
      data: [{ id: 'm1', name: 'Cozinha', leaderName: 'João', filhoCount: 1, servoCount: 1 }],
      isLoading: false,
    };
    render(<MinistriesTab houseId="h1" />);
    fireEvent.click(screen.getByTitle('Editar responsável'));
    expect(screen.getByTestId('edit-ministry')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Remover ministério'));
    expect(screen.getByTestId('remove-ministry')).toBeInTheDocument();
  });
});
