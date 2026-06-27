import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const mutate = vi.fn();
let mutState = { isPending: false };

vi.mock('../hooks/useResidents', () => ({
  useAddRelative: () => ({ mutate, ...mutState }),
}));

import { AddRelativeDialog } from './AddRelativeDialog';

beforeEach(() => {
  vi.clearAllMocks();
  mutState = { isPending: false };
});
afterEach(() => cleanup());

describe('AddRelativeDialog', () => {
  it('renderiza título e campos', () => {
    render(<AddRelativeDialog open onClose={vi.fn()} residentId="r1" />);
    expect(screen.getByText('Adicionar familiar')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome *')).toBeInTheDocument();
    expect(screen.getByLabelText('Parentesco')).toBeInTheDocument();
  });

  it('submit sem nome bloqueia e mostra erro', async () => {
    render(<AddRelativeDialog open onClose={vi.fn()} residentId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument());
    expect(mutate).not.toHaveBeenCalled();
  });

  it('seleciona "Outro" revela campo de especificação e envia o valor digitado', async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<AddRelativeDialog open onClose={onClose} residentId="r1" />);
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Fulana' } });
    fireEvent.change(screen.getByLabelText('Parentesco'), { target: { value: 'Outro' } });
    const especifique = screen.getByPlaceholderText('Especifique o parentesco');
    fireEvent.change(especifique, { target: { value: 'Vizinha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toMatchObject({ name: 'Fulana', relationship: 'Vizinha' });
    expect(onClose).toHaveBeenCalled();
  });

  it('envia o parentesco selecionado diretamente quando não é "Outro"', async () => {
    mutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<AddRelativeDialog open onClose={vi.fn()} residentId="r1" />);
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText('Parentesco'), { target: { value: 'Mãe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0].relationship).toBe('Mãe');
    expect(screen.queryByPlaceholderText('Especifique o parentesco')).not.toBeInTheDocument();
  });

  it('cancelar dispara onClose', () => {
    const onClose = vi.fn();
    render(<AddRelativeDialog open onClose={onClose} residentId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
