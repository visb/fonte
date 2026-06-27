import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const mutate = vi.fn();
let mutState = { isPending: false };

vi.mock('../../hooks/useHouseRules', () => ({
  useCreateRule: () => ({ mutate, ...mutState }),
}));

import { AddRuleDialog } from './AddRuleDialog';

beforeEach(() => {
  vi.clearAllMocks();
  mutState = { isPending: false };
});
afterEach(() => cleanup());

describe('AddRuleDialog', () => {
  it('renderiza título e campos', () => {
    render(<AddRuleDialog open onClose={vi.fn()} houseId="h1" />);
    expect(screen.getByText('Nova Regra')).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Conteúdo/)).toBeInTheDocument();
  });

  it('submit vazio bloqueia e mostra erros do zod', async () => {
    render(<AddRuleDialog open onClose={vi.fn()} houseId="h1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.getByText('Título é obrigatório')).toBeInTheDocument());
    expect(screen.getByText('Conteúdo é obrigatório')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('submit válido muta e fecha', async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<AddRuleDialog open onClose={onClose} houseId="h1" />);
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Recolher' } });
    fireEvent.change(screen.getByLabelText(/Conteúdo/), { target: { value: '22h' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toMatchObject({ title: 'Recolher', content: '22h' });
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelar dispara onClose', () => {
    const onClose = vi.fn();
    render(<AddRuleDialog open onClose={onClose} houseId="h1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
