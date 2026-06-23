import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Associate } from '@fonte/api-client';
import { AssociateForm } from './AssociateForm';

afterEach(() => cleanup());

function makeAssociate(overrides: Partial<Associate> = {}): Associate {
  return {
    id: 'a1',
    name: 'Maria',
    whatsapp: '+5562999998888',
    email: 'maria@x.com',
    contributionAmount: 50,
    dueDay: 10,
    ...overrides,
  } as Associate;
}

function renderForm(props: Partial<Parameters<typeof AssociateForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <AssociateForm associate={null} isPending={false} error={null} onSubmit={onSubmit} onCancel={onCancel} {...props} />,
  );
  return { onSubmit, onCancel };
}

describe('AssociateForm', () => {
  it('modo editar preenche nome e formata o WhatsApp', () => {
    renderForm({ associate: makeAssociate() });
    expect((screen.getByLabelText('Nome *') as HTMLInputElement).value).toBe('Maria');
    const wpp = screen.getByLabelText('WhatsApp *') as HTMLInputElement;
    // máscara aplicada sobre o E.164 armazenado
    expect(wpp.value).toMatch(/\+55/);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('submit inválido não chama onSubmit', async () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(screen.getByLabelText('Nome *')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('digita WhatsApp e converte para E.164 no submit', async () => {
    const { onSubmit } = renderForm();
    fireEvent.input(screen.getByLabelText('Nome *'), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText('WhatsApp *'), { target: { value: '62 99999-8888' } });
    fireEvent.input(screen.getByLabelText('Contribuição (R$) *'), { target: { value: '40' } });
    fireEvent.input(screen.getByLabelText('Dia de vencimento *'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const data = onSubmit.mock.calls[0][0];
    expect(data.name).toBe('João');
    expect(data.whatsapp).toMatch(/^\+55/);
  });

  it('mostra erro de API e cancelar dispara onCancel', () => {
    const { onCancel } = renderForm({ error: new Error('x') });
    expect(screen.getByText(/Erro ao salvar associado|x/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('pending desabilita submit', () => {
    renderForm({ isPending: true });
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });
});
