import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Event } from '@fonte/api-client';
import { EventAudience } from '@fonte/api-client';
import { EventForm } from './EventForm';

afterEach(() => cleanup());

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    title: 'Retiro',
    description: 'Retiro anual',
    startAt: '2026-09-01T13:00:00.000Z',
    endAt: null,
    location: 'Sede',
    audience: EventAudience.PUBLIC,
    capacity: null,
    registrationEnabled: false,
    paymentEnabled: false,
    priceCents: null,
    registrationFields: [],
    registrationOpensAt: null,
    registrationClosesAt: null,
    ...overrides,
  } as Event;
}

function renderForm(props: Partial<Parameters<typeof EventForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <EventForm event={null} isPending={false} error={null} onSubmit={onSubmit} onCancel={onCancel} {...props} />,
  );
  return { onSubmit, onCancel };
}

describe('EventForm', () => {
  it('modo criar tem campos vazios e botão "Criar"', () => {
    renderForm();
    expect((screen.getByLabelText('Título *') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
  });

  it('modo editar preenche título/descrição e mostra "Salvar"', () => {
    renderForm({ event: makeEvent() });
    expect((screen.getByLabelText('Título *') as HTMLInputElement).value).toBe('Retiro');
    expect((screen.getByLabelText('Descrição *') as HTMLTextAreaElement).value).toBe('Retiro anual');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('submit inválido bloqueia onSubmit e mostra erros', async () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(screen.getByLabelText('Título *')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submit válido chama onSubmit', async () => {
    const { onSubmit } = renderForm();
    fireEvent.input(screen.getByLabelText('Título *'), { target: { value: 'Festa' } });
    fireEvent.input(screen.getByLabelText('Descrição *'), { target: { value: 'Festa junina' } });
    fireEvent.input(screen.getByLabelText('Início *'), { target: { value: '2026-06-30T18:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].title).toBe('Festa');
  });

  it('mostra erro de API e cancelar dispara onCancel', () => {
    const { onCancel } = renderForm({ error: new Error('x') });
    expect(screen.getByText(/Erro ao salvar evento|x/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('pending desabilita submit', () => {
    renderForm({ isPending: true });
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });

  // ── Audiência / eventos internos (story 94) ───────────────────────────────

  it('mostra a seção de inscrição para evento público (default)', () => {
    renderForm();
    expect(screen.getByTestId('event-audience')).toBeInTheDocument();
    expect(screen.getByTestId('registration-enabled')).toBeInTheDocument();
  });

  it('esconde inscrição/cobrança ao selecionar Interno', async () => {
    renderForm();
    fireEvent.change(screen.getByTestId('event-audience'), {
      target: { value: EventAudience.INTERNAL },
    });
    await waitFor(() =>
      expect(screen.queryByTestId('registration-enabled')).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId('payment-enabled')).not.toBeInTheDocument();
  });

  it('evento interno em edição não renderiza a seção de inscrição', () => {
    renderForm({ event: makeEvent({ audience: EventAudience.INTERNAL }) });
    expect(screen.queryByTestId('registration-enabled')).not.toBeInTheDocument();
  });
});
