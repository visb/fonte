import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const state = { mutate: vi.fn(), isPending: false, isError: false, error: null as unknown };
vi.mock('../hooks/useStaff', () => ({ useResetStaffPassword: () => state }));

import { ResetPasswordDialog } from './ResetPasswordDialog';

const staff = { id: 's1', name: 'Servo João' };

beforeEach(() => {
  vi.clearAllMocks();
  state.mutate = vi.fn();
  state.isPending = false;
  state.isError = false;
  state.error = null;
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});
afterEach(() => cleanup());

describe('ResetPasswordDialog (staff)', () => {
  it('fechado não renderiza o conteúdo', () => {
    render(<ResetPasswordDialog open={false} onClose={vi.fn()} staff={staff} />);
    expect(screen.queryByText('Resetar Senha')).not.toBeInTheDocument();
  });

  it('aberto mostra o nome do servo e a senha gerada (12 chars)', () => {
    render(<ResetPasswordDialog open onClose={vi.fn()} staff={staff} />);
    expect(screen.getByText('Servo João')).toBeInTheDocument();
    const input = screen.getByDisplayValue(/.{12}/) as HTMLInputElement;
    expect(input.value).toHaveLength(12);
    expect(input.type).toBe('password');
  });

  it('toggle de visibilidade alterna o tipo do input', () => {
    render(<ResetPasswordDialog open onClose={vi.fn()} staff={staff} />);
    const input = document.querySelector('input') as HTMLInputElement;
    fireEvent.click(input.parentElement!.querySelector('button')!);
    expect(input.type).toBe('text');
  });

  it('copiar usa o clipboard e mostra "Copiado!"', () => {
    render(<ResetPasswordDialog open onClose={vi.fn()} staff={staff} />);
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.getByText('Copiado!')).toBeInTheDocument();
  });

  it('confirmar muta com a senha e fecha no sucesso', () => {
    const onClose = vi.fn();
    state.mutate = vi.fn((_pwd, opts) => opts.onSuccess());
    render(<ResetPasswordDialog open onClose={onClose} staff={staff} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Reset/ }));
    expect(state.mutate).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
    expect(onClose).toHaveBeenCalled();
  });

  it('mostra erro da mutation', () => {
    state.isError = true;
    state.error = new Error('falha');
    render(<ResetPasswordDialog open onClose={vi.fn()} staff={staff} />);
    expect(screen.getByText(/Erro ao resetar senha|falha/)).toBeInTheDocument();
  });
});
