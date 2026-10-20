import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mutate = vi.fn();
const reset = vi.fn();
let state = { isPending: false, isError: false, error: null as unknown };

vi.mock('../hooks/useStaff', () => ({
  useDeleteStaff: () => ({ mutate, reset, ...state }),
}));

import { DeleteStaffDialog } from './DeleteStaffDialog';

const staff = { id: 's1', name: 'Pedro Servo' };

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false, isError: false, error: null };
});
afterEach(() => cleanup());

describe('DeleteStaffDialog (story 217)', () => {
  it('fechado quando não há alvo', () => {
    render(<DeleteStaffDialog staff={null} onClose={vi.fn()} />);
    expect(screen.queryByText('Excluir cadastro')).toBeNull();
  });

  it('exige digitar EXCLUIR antes de excluir', async () => {
    render(<DeleteStaffDialog staff={staff} onClose={vi.fn()} />);
    expect(screen.getByText('Pedro Servo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('Digite EXCLUIR para confirmar.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('com a confirmação exclui, fecha e avisa', async () => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    mutate.mockImplementation((_id, opts) => opts.onSuccess());
    render(<DeleteStaffDialog staff={staff} onClose={onClose} onDeleted={onDeleted} />);
    fireEvent.change(screen.getByLabelText('Digite EXCLUIR para confirmar'), { target: { value: 'excluir' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toBe('s1');
    expect(onClose).toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalled();
  });

  it('sem onDeleted só fecha; erro e envio', async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_id, opts) => opts.onSuccess());
    render(<DeleteStaffDialog staff={staff} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Digite EXCLUIR para confirmar'), { target: { value: 'EXCLUIR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    cleanup();

    state = { isPending: true, isError: true, error: new Error('boom') };
    render(<DeleteStaffDialog staff={staff} onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao excluir o cadastro|boom/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluindo...' })).toBeDisabled();
  });

  it('cancelar reseta e fecha', () => {
    const onClose = vi.fn();
    render(<DeleteStaffDialog staff={staff} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
