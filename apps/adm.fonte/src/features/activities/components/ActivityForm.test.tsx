import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Activity } from '@fonte/api-client';

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }] }),
}));

import { ActivityForm } from './ActivityForm';

function renderForm(over: Partial<Parameters<typeof ActivityForm>[0]> = {}) {
  const props = { activity: null, isPending: false, error: null, onSubmit: vi.fn(), onCancel: vi.fn(), ...over };
  render(<ActivityForm {...props} />);
  return props;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ActivityForm', () => {
  it('criar: campos vazios e botão "Criar"', () => {
    renderForm();
    expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
    expect(screen.getByText('Geral (sem casa)')).toBeInTheDocument();
  });

  it('editar: preenche os campos e botão "Salvar"', () => {
    renderForm({ activity: { title: 'Limpeza', description: 'desc', houseId: 'h1' } as unknown as Activity });
    expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe('Limpeza');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('submit inválido (sem título) não chama onSubmit', async () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
    // título continua vazio → o form bloqueia o submit via zod
    expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe('');
  });

  it('submit válido chama onSubmit com os dados', async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Consertar portão' } });
    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].title).toBe('Consertar portão');
    expect(onSubmit.mock.calls[0][0].houseId).toBe('h1');
  });

  it('mostra erro de API e estado pending', () => {
    renderForm({ error: new Error('boom'), isPending: true });
    expect(screen.getByText(/Erro ao salvar atividade|boom/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });

  it('cancelar dispara onCancel', () => {
    const { onCancel } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
