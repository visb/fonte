import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const mutate = vi.fn();
const reset = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useChangePassword: () => ({
    mutate,
    reset,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

import { ChangePasswordDialog } from './ChangePasswordDialog';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

function fill(newPw: string, confirmPw: string) {
  fireEvent.input(screen.getByLabelText('Nova senha'), { target: { value: newPw } });
  fireEvent.input(screen.getByLabelText('Confirmar senha'), { target: { value: confirmPw } });
}

describe('ChangePasswordDialog', () => {
  it('renderiza título e campos quando aberto', () => {
    render(<ChangePasswordDialog open onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Alterar senha' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nova senha')).toBeInTheDocument();
  });

  it('submit inválido (senha curta) mostra erro de schema e não muta', async () => {
    render(<ChangePasswordDialog open onClose={vi.fn()} />);
    fill('123', '123');
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
    expect(await screen.findByText('Mínimo 6 caracteres')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('submit inválido (senhas diferentes) mostra erro de confirmação', async () => {
    render(<ChangePasswordDialog open onClose={vi.fn()} />);
    fill('abcdef', 'xyzxyz');
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
    expect(await screen.findByText('Senhas não coincidem')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('submit válido muta com a nova senha', async () => {
    render(<ChangePasswordDialog open onClose={vi.fn()} />);
    fill('segura123', 'segura123');
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith('segura123', expect.objectContaining({ onSuccess: expect.any(Function) })),
    );
  });

  it('alterna visibilidade da senha', () => {
    render(<ChangePasswordDialog open onClose={vi.fn()} />);
    const input = screen.getByLabelText('Nova senha') as HTMLInputElement;
    expect(input.type).toBe('password');
    // botão de olho é o irmão sem label; pega pelo container
    const toggles = screen.getAllByRole('button').filter((b) => b.getAttribute('tabindex') === '-1');
    fireEvent.click(toggles[0]);
    expect(input.type).toBe('text');
  });
});
