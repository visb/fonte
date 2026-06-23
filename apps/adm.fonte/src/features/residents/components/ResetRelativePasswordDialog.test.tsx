import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const state = { mutate: vi.fn(), isPending: false, isError: false, error: null as unknown };
vi.mock('../hooks/useResidents', () => ({ useResetRelativePassword: () => state }));

import { ResetRelativePasswordDialog } from './ResetRelativePasswordDialog';

const relative = { id: 'rel1', name: 'Familiar Ana' };

beforeEach(() => {
  vi.clearAllMocks();
  state.mutate = vi.fn();
  state.isPending = false;
  state.isError = false;
  state.error = null;
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});
afterEach(() => cleanup());

describe('ResetRelativePasswordDialog', () => {
  it('aberto mostra nome do familiar e senha de 12 chars', () => {
    render(<ResetRelativePasswordDialog open onClose={vi.fn()} relative={relative} />);
    expect(screen.getByText('Familiar Ana')).toBeInTheDocument();
    expect((screen.getByDisplayValue(/.{12}/) as HTMLInputElement).value).toHaveLength(12);
  });

  it('toggle de visibilidade e copiar funcionam', () => {
    render(<ResetRelativePasswordDialog open onClose={vi.fn()} relative={relative} />);
    const input = document.querySelector('input') as HTMLInputElement;
    fireEvent.click(input.parentElement!.querySelector('button')!);
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('confirmar muta e fecha no sucesso', () => {
    const onClose = vi.fn();
    state.mutate = vi.fn((_p, opts) => opts.onSuccess());
    render(<ResetRelativePasswordDialog open onClose={onClose} relative={relative} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Reset/ }));
    expect(state.mutate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('erro da mutation aparece', () => {
    state.isError = true;
    state.error = new Error('Erro ao resetar senha.');
    render(<ResetRelativePasswordDialog open onClose={vi.fn()} relative={relative} />);
    expect(screen.getByText('Erro ao resetar senha.')).toBeInTheDocument();
  });
});
