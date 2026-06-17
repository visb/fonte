import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubscribeForm } from './SubscribeForm';

function fillCard(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    number?: string;
    holder?: string;
    month?: string;
    year?: string;
    cvv?: string;
  } = {},
) {
  return (async () => {
    await user.type(screen.getByLabelText('Número do cartão'), values.number ?? '4111111111111111');
    await user.type(screen.getByLabelText('Nome impresso no cartão'), values.holder ?? 'JOAO SILVA');
    await user.type(screen.getByLabelText('Mês (MM)'), values.month ?? '12');
    await user.type(screen.getByLabelText('Ano (AA)'), values.year ?? '30');
    await user.type(screen.getByLabelText('CVV'), values.cvv ?? '123');
  })();
}

describe('SubscribeForm — AmountSummary (gross-up preview)', () => {
  it('mostra contribuição, taxa e total cobrado no cartão', () => {
    render(<SubscribeForm amount={100} submitting={false} onSubmit={vi.fn()} />);

    expect(screen.getByText('Sua contribuição (a Fonte recebe)')).toBeInTheDocument();
    expect(screen.getByText('Taxa do cartão')).toBeInTheDocument();
    expect(screen.getByText('Cobrado no cartão')).toBeInTheDocument();
    // Sem taxa configurada no test env, o cobrado == contribuição.
    expect(screen.getAllByText('R$ 100,00').length).toBeGreaterThanOrEqual(2);
  });
});

describe('SubscribeForm — validação do schema zod', () => {
  it('bloqueia submit e mostra erros quando o cartão é inválido', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SubscribeForm amount={100} submitting={false} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Número do cartão'), '123'); // < 13 dígitos
    await user.type(screen.getByLabelText('Mês (MM)'), '13'); // mês inválido
    await user.click(screen.getByRole('button', { name: /ativar contribuição mensal/i }));

    expect(await screen.findByText('Número do cartão inválido')).toBeInTheDocument();
    expect(screen.getByText('MM')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('com dados válidos tokeniza via stub e chama onSubmit com cardToken', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SubscribeForm amount={100} submitting={false} onSubmit={onSubmit} />);

    await fillCard(user);
    await user.click(screen.getByRole('button', { name: /ativar contribuição mensal/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.cardToken).toMatch(/^dev_tok_1111_\d+$/);
  });

  it('exibe o badge de modo desenvolvimento (tokenização stub)', () => {
    render(<SubscribeForm amount={100} submitting={false} onSubmit={vi.fn()} />);
    expect(screen.getByText(/modo desenvolvimento/i)).toBeInTheDocument();
  });
});
