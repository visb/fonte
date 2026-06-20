import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EventRegistrationResult } from '@fonte/types';
import { RegistrationSuccess } from './RegistrationSuccess';

function result(overrides: Partial<EventRegistrationResult> = {}): EventRegistrationResult {
  return {
    id: 'reg-1',
    eventId: 'e1',
    name: 'Maria',
    paymentStatus: 'NONE' as EventRegistrationResult['paymentStatus'],
    paymentToken: null,
    ...overrides,
  };
}

describe('RegistrationSuccess (story 70)', () => {
  it('evento grátis: só confirma a inscrição', () => {
    render(<RegistrationSuccess result={result()} eventTitle="Retiro" />);
    expect(screen.getByRole('heading', { name: /inscrição confirmada/i })).toBeInTheDocument();
    expect(screen.queryByText(/copiar link de pagamento/i)).not.toBeInTheDocument();
  });

  it('evento pago: mostra o link /pagamento/:token e botão de copiar', () => {
    render(
      <RegistrationSuccess
        result={result({
          paymentStatus: 'PENDING' as EventRegistrationResult['paymentStatus'],
          paymentToken: 'tok-9',
        })}
        eventTitle="Retiro pago"
      />,
    );
    expect(screen.getByRole('heading', { name: /inscrição recebida/i })).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/pagamento/tok-9'));
    expect(screen.getByRole('button', { name: /copiar link de pagamento/i })).toBeInTheDocument();
    expect(screen.getByText(/enviamos este link por e-mail e whatsapp/i)).toBeInTheDocument();
  });
});
