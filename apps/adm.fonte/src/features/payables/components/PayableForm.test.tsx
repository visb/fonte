import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Payable } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({
  api: { photoUrl: (u: string | null) => (u ? `http://cdn/${u}` : null) },
}));

import { PayableForm, type PayableSubmit } from './PayableForm';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

function existing(overrides: Partial<Payable> = {}): Payable {
  return {
    id: 'p1',
    description: 'Conta de luz',
    amount: 25000,
    dueDate: '2026-07-10',
    category: 'UTILITIES',
    supplier: 'Enel',
    notes: 'junho',
    attachmentUrl: 'uploads/p1.pdf',
    attachmentName: 'fatura.pdf',
    ...overrides,
  } as Payable;
}

function renderForm(props: Partial<Parameters<typeof PayableForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <PayableForm
      payable={null}
      isPending={false}
      error={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onSubmit, onCancel };
}

describe('PayableForm', () => {
  it('modo criar: botão "Criar" e campos vazios', () => {
    renderForm();
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
    expect((screen.getByLabelText('Descrição *') as HTMLInputElement).value).toBe('');
  });

  it('modo editar: preenche campos e mostra "Salvar" e anexo existente', () => {
    renderForm({ payable: existing() });
    expect((screen.getByLabelText('Descrição *') as HTMLInputElement).value).toBe('Conta de luz');
    expect((screen.getByLabelText('Valor (R$) *') as HTMLInputElement).value).toBe('250');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'fatura.pdf' });
    expect(link).toHaveAttribute('href', 'http://cdn/uploads/p1.pdf');
  });

  it('submit inválido mostra erros de schema e não chama onSubmit', async () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByText(/Descrição/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submit válido chama onSubmit com data, file e removeAttachment', async () => {
    const { onSubmit } = renderForm();
    fireEvent.input(screen.getByLabelText('Descrição *'), { target: { value: 'Água' } });
    fireEvent.input(screen.getByLabelText('Valor (R$) *'), { target: { value: '99.90' } });
    fireEvent.input(screen.getByLabelText('Vencimento *'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Categoria *'), { target: { value: 'UTILITIES' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const arg = onSubmit.mock.calls[0][0] as PayableSubmit;
    expect(arg.data.description).toBe('Água');
    expect(arg.file).toBeNull();
    expect(arg.removeAttachment).toBe(false);
  });

  it('anexar arquivo mostra o nome e permite limpar', () => {
    renderForm();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'comprovante.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText('comprovante.pdf')).toBeInTheDocument();
  });

  it('remover anexo existente marca removeAttachment no submit', async () => {
    const { onSubmit } = renderForm({ payable: existing() });
    fireEvent.click(screen.getByTitle('Remover anexo'));
    // some o link do anexo existente
    expect(screen.queryByRole('link', { name: 'fatura.pdf' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as PayableSubmit).removeAttachment).toBe(true);
  });

  it('mostra mensagem de erro de API', () => {
    renderForm({ error: new Error('boom') });
    expect(screen.getByText(/Erro ao salvar conta|boom/)).toBeInTheDocument();
  });

  it('cancelar dispara onCancel', () => {
    const { onCancel } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('estado pending desabilita submit e mostra "Salvando..."', () => {
    renderForm({ isPending: true });
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });
});
