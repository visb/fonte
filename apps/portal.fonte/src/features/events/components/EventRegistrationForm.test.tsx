import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EventPublic } from '@fonte/types';
import { EventRegistrationForm } from './EventRegistrationForm';

function makeEvent(overrides: Partial<EventPublic> = {}): EventPublic {
  return {
    id: 'e1',
    title: 'Retiro',
    description: 'Encontro',
    startAt: '2027-01-10T10:00:00.000Z',
    endAt: null,
    location: 'Sede',
    bannerUrl: null,
    capacity: 10,
    spotsLeft: 5,
    registrationFields: [],
    registrationOpensAt: null,
    registrationClosesAt: null,
    registrationOpen: true,
    ...overrides,
  };
}

describe('EventRegistrationForm', () => {
  it('mostra o formulário e as vagas restantes quando a inscrição está aberta', () => {
    render(
      <EventRegistrationForm event={makeEvent()} submitting={false} error={null} onSubmit={vi.fn()} />,
    );
    expect(screen.getByRole('heading', { name: 'Inscreva-se' })).toBeInTheDocument();
    expect(screen.getByText(/5 vaga\(s\) restante\(s\)/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
  });

  it('mostra "Vagas esgotadas" quando lotado', () => {
    render(
      <EventRegistrationForm
        event={makeEvent({ registrationOpen: false, spotsLeft: 0 })}
        submitting={false}
        error={null}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Vagas esgotadas' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
  });

  it('mostra "Inscrições encerradas" quando fechado mas não esgotado', () => {
    render(
      <EventRegistrationForm
        event={makeEvent({ registrationOpen: false, spotsLeft: null })}
        submitting={false}
        error={null}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Inscrições encerradas' })).toBeInTheDocument();
  });

  it('valida campos obrigatórios e bloqueia submit', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <EventRegistrationForm event={makeEvent()} submitting={false} error={null} onSubmit={onSubmit} />,
    );

    await user.click(screen.getByRole('button', { name: 'Confirmar inscrição' }));

    await waitFor(() => {
      expect(screen.getByText('Informe seu nome')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submete os dados quando válidos', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <EventRegistrationForm event={makeEvent()} submitting={false} error={null} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByLabelText('Nome'), 'Maria');
    await user.type(screen.getByLabelText('Telefone / WhatsApp'), '11999990000');
    await user.click(screen.getByRole('button', { name: 'Confirmar inscrição' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Maria',
        contact: '11999990000',
        email: null,
        answers: {},
      });
    });
  });

  it('renderiza os campos custom e valida um select obrigatório (story 68)', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const event = makeEvent({
      registrationFields: [
        { id: 'shirt', label: 'Tamanho', type: 'select', required: true, order: 0, options: ['P', 'M'] },
      ],
    });
    render(
      <EventRegistrationForm event={event} submitting={false} error={null} onSubmit={onSubmit} />,
    );

    expect(screen.getByText('Tamanho *')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nome'), 'Maria');
    await user.type(screen.getByLabelText('Telefone / WhatsApp'), '11999990000');
    await user.click(screen.getByRole('button', { name: 'Confirmar inscrição' }));

    // Select obrigatório não preenchido bloqueia o submit.
    await waitFor(() => {
      expect(screen.getByText('Selecione uma opção')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia as respostas custom em answers quando preenchidas (story 68)', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const event = makeEvent({
      registrationFields: [
        { id: 'shirt', label: 'Tamanho', type: 'select', required: true, order: 0, options: ['P', 'M'] },
      ],
    });
    render(
      <EventRegistrationForm event={event} submitting={false} error={null} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByLabelText('Nome'), 'Maria');
    await user.type(screen.getByLabelText('Telefone / WhatsApp'), '11999990000');
    await user.selectOptions(screen.getByLabelText('Tamanho *'), 'M');
    await user.click(screen.getByRole('button', { name: 'Confirmar inscrição' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Maria',
        contact: '11999990000',
        email: null,
        answers: { shirt: 'M' },
      });
    });
  });
});
