import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const state = { mutate: vi.fn(), isPending: false, isError: false, error: null as unknown };
vi.mock('../hooks/useResidents', () => ({ useResetResidentPassword: () => state }));

import { ResetResidentPasswordDialog } from './ResetResidentPasswordDialog';

const resident = { id: 'r1', name: 'Interno Pedro' };

beforeEach(() => {
  vi.clearAllMocks();
  state.mutate = vi.fn();
  state.isPending = false;
  state.isError = false;
  state.error = null;
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});
afterEach(() => cleanup());

describe('ResetResidentPasswordDialog', () => {
  it('fechado não renderiza', () => {
    render(<ResetResidentPasswordDialog open={false} onClose={vi.fn()} resident={resident} />);
    expect(screen.queryByText('Resetar Senha')).not.toBeInTheDocument();
  });

  it('mostra nome do interno e senha de 12 chars', () => {
    render(<ResetResidentPasswordDialog open onClose={vi.fn()} resident={resident} />);
    expect(screen.getByText('Interno Pedro')).toBeInTheDocument();
    expect((screen.getByDisplayValue(/.{12}/) as HTMLInputElement).value).toHaveLength(12);
  });

  it('copiar usa clipboard', () => {
    render(<ResetResidentPasswordDialog open onClose={vi.fn()} resident={resident} />);
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('confirmar muta e fecha; não muta sem resident', () => {
    const onClose = vi.fn();
    state.mutate = vi.fn((_p, opts) => opts.onSuccess());
    const { rerender } = render(<ResetResidentPasswordDialog open onClose={onClose} resident={resident} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Reset/ }));
    expect(state.mutate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    state.mutate = vi.fn();
    rerender(<ResetResidentPasswordDialog open onClose={onClose} resident={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Reset/ }));
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it('erro da mutation aparece', () => {
    state.isError = true;
    state.error = new Error('Erro ao resetar senha.');
    render(<ResetResidentPasswordDialog open onClose={vi.fn()} resident={resident} />);
    expect(screen.getByText('Erro ao resetar senha.')).toBeInTheDocument();
  });
});
