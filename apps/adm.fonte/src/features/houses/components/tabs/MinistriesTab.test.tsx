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
vi.mock('./MinistryResidentsDialog', () => ({
  MinistryResidentsDialog: ({ ministry, onClose }: { ministry: unknown; onClose: () => void }) =>
    ministry ? <button data-testid="ministry-residents" onClick={onClose}>fechar filhos</button> : null,
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

  // Story 205 (decisão 10): contagem separada "N servos · M filhos".
  it('lista ministérios com responsável e contagens de servos e filhos (singular/plural)', () => {
    listState = {
      data: [
        { id: 'm1', name: 'Cozinha', leaderName: 'João', servoCount: 2, filhoCount: 1 },
        { id: 'm2', name: 'Limpeza', leaderName: null, servoCount: 1, filhoCount: 5 },
      ],
      isLoading: false,
    };
    render(<MinistriesTab houseId="h1" />);
    expect(screen.getByText('Cozinha')).toBeInTheDocument();
    expect(screen.getByText(/Responsável: João · 2 servos · 1 filho$/)).toBeInTheDocument();
    expect(screen.getByText(/Responsável: Não definido · 1 servo · 5 filhos$/)).toBeInTheDocument();
  });

  it('abre dialog de novo ministério', () => {
    render(<MinistriesTab houseId="h1" />);
    fireEvent.click(screen.getByRole('button', { name: /Novo ministério/ }));
    expect(screen.getByTestId('add-ministry')).toBeInTheDocument();
  });

  it('abre filhos, editar e remover responsável de um ministério', () => {
    listState = {
      data: [{ id: 'm1', name: 'Cozinha', leaderName: 'João', servoCount: 1, filhoCount: 0 }],
      isLoading: false,
    };
    render(<MinistriesTab houseId="h1" />);
    fireEvent.click(screen.getByTitle('Filhos do ministério'));
    expect(screen.getByTestId('ministry-residents')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ministry-residents'));
    expect(screen.queryByTestId('ministry-residents')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Editar responsável'));
    expect(screen.getByTestId('edit-ministry')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Remover ministério'));
    expect(screen.getByTestId('remove-ministry')).toBeInTheDocument();
  });
});
