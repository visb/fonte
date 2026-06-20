import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PayEventResult } from '@fonte/types';
import { EventPaymentChoice } from './EventPaymentChoice';

const pixResult: PayEventResult = {
  paymentStatus: 'PENDING' as PayEventResult['paymentStatus'],
  method: 'pix',
  pix: { qrCode: '00020126PIX', qrCodeUrl: 'https://qr/img.png', expiresAt: null },
};

describe('EventPaymentChoice (story 70)', () => {
  it('mostra o valor da inscrição e os métodos', () => {
    render(
      <EventPaymentChoice
        amountCents={5248}
        submitting={false}
        error={null}
        result={undefined}
        onPay={vi.fn()}
      />,
    );
    expect(screen.getByText('Valor da inscrição')).toBeInTheDocument();
    expect(screen.getByText('R$ 52,48')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartão de crédito' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PIX' })).toBeInTheDocument();
  });

  it('cartão: tokeniza via stub e chama onPay com cardToken', async () => {
    const user = userEvent.setup();
    const onPay = vi.fn();
    render(
      <EventPaymentChoice
        amountCents={5248}
        submitting={false}
        error={null}
        result={undefined}
        onPay={onPay}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cartão de crédito' }));
    await user.type(screen.getByLabelText('Número do cartão'), '4111111111111111');
    await user.type(screen.getByLabelText('Nome impresso no cartão'), 'MARIA D');
    await user.type(screen.getByLabelText('Mês (MM)'), '12');
    await user.type(screen.getByLabelText('Ano (AA)'), '30');
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.click(screen.getByRole('button', { name: 'Pagar com cartão' }));

    await waitFor(() => expect(onPay).toHaveBeenCalledTimes(1));
    const arg = onPay.mock.calls[0][0];
    expect(arg.method).toBe('credit_card');
    expect(arg.cardToken).toMatch(/^dev_tok_1111_\d+$/);
  });

  it('PIX: dispara onPay com method pix', async () => {
    const user = userEvent.setup();
    const onPay = vi.fn();
    render(
      <EventPaymentChoice
        amountCents={5248}
        submitting={false}
        error={null}
        result={undefined}
        onPay={onPay}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'PIX' }));
    await user.click(screen.getByRole('button', { name: 'Gerar PIX' }));

    expect(onPay).toHaveBeenCalledWith({ method: 'pix' });
  });

  it('mostra o QR e o copia-e-cola quando o resultado é PIX', () => {
    render(
      <EventPaymentChoice
        amountCents={5248}
        submitting={false}
        error={null}
        result={pixResult}
        onPay={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Pague com PIX' })).toBeInTheDocument();
    expect(screen.getByAltText('QR code do PIX')).toHaveAttribute('src', 'https://qr/img.png');
    expect(screen.getByDisplayValue('00020126PIX')).toBeInTheDocument();
  });
});
