import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ActivityStatus } from '@fonte/types';

const createMutate = vi.fn();
const createReset = vi.fn();
let state = { isPending: false, error: null as unknown };

vi.mock('../hooks/useActivities', () => ({
  useCreateActivity: () => ({ mutate: createMutate, reset: createReset, ...state }),
}));

import { QuickAddCard } from './QuickAddCard';

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false, error: null };
});
afterEach(() => cleanup());

describe('QuickAddCard', () => {
  it('estado fechado: mostra "Adicionar atividade"', () => {
    render(<QuickAddCard status={ActivityStatus.TODO} />);
    expect(screen.getByRole('button', { name: /Adicionar atividade/ })).toBeInTheDocument();
  });

  it('abre o formulário ao clicar', () => {
    render(<QuickAddCard status={ActivityStatus.TODO} />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar atividade/ }));
    expect(screen.getByLabelText('Título da nova atividade')).toBeInTheDocument();
  });

  it('submit vazio mostra erro de título e não muta', async () => {
    render(<QuickAddCard status={ActivityStatus.TODO} />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar atividade/ }));
    fireEvent.submit(screen.getByLabelText('Título da nova atividade').closest('form')!);
    expect(await screen.findByText('O título é obrigatório')).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('submit válido muta com título e status', async () => {
    render(<QuickAddCard status={ActivityStatus.DOING} />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar atividade/ }));
    fireEvent.input(screen.getByLabelText('Título da nova atividade'), { target: { value: 'Regar horta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toMatchObject({ title: 'Regar horta', status: ActivityStatus.DOING });
  });

  it('cancelar fecha o formulário', () => {
    render(<QuickAddCard status={ActivityStatus.TODO} />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar atividade/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Título da nova atividade')).not.toBeInTheDocument();
  });

  it('mostra erro de criação da mutation', () => {
    state = { isPending: false, error: new Error('boom') };
    render(<QuickAddCard status={ActivityStatus.TODO} />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar atividade/ }));
    expect(screen.getByText(/Erro ao criar atividade|boom/)).toBeInTheDocument();
  });
});
