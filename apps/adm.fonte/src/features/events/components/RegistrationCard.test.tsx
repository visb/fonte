import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { EventRegistration, RegistrationField } from '@fonte/api-client';
import { EventPaymentStatus } from '@fonte/api-client';
import { RegistrationCard } from './RegistrationCard';

function registration(over: Partial<EventRegistration> = {}): EventRegistration {
  return {
    id: 'r1',
    name: 'Maria Silva',
    contact: '5511999990000',
    email: 'maria@example.com',
    paymentStatus: EventPaymentStatus.NONE,
    amountCents: null,
    answers: {},
    ...over,
  } as unknown as EventRegistration;
}

afterEach(() => cleanup());

describe('RegistrationCard', () => {
  it('mostra base fixa (nome, contato, e-mail)', () => {
    render(<RegistrationCard registration={registration()} fields={[]} />);
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('5511999990000')).toBeInTheDocument();
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
  });

  it('oculta o badge de pagamento quando status é NONE', () => {
    render(<RegistrationCard registration={registration()} fields={[]} />);
    expect(screen.queryByTestId('registration-payment-status')).not.toBeInTheDocument();
  });

  it('mostra badge de pagamento com valor quando PAID', () => {
    render(
      <RegistrationCard
        registration={registration({ paymentStatus: EventPaymentStatus.PAID, amountCents: 5000 })}
        fields={[]}
      />,
    );
    const badge = screen.getByTestId('registration-payment-status');
    expect(badge).toHaveTextContent('Pago');
    expect(badge).toHaveTextContent(/50,00/);
  });

  it('renderiza respostas de campos custom e ignora vazios', () => {
    const fields: RegistrationField[] = [
      { id: 'f1', label: 'Camiseta', type: 'select' } as RegistrationField,
      { id: 'f2', label: 'Vegetariano', type: 'boolean' } as RegistrationField,
      { id: 'f3', label: 'Observação', type: 'text' } as RegistrationField,
    ];
    render(
      <RegistrationCard
        registration={registration({
          answers: { f1: 'M', f2: true, f3: '' },
        })}
        fields={fields}
      />,
    );
    expect(screen.getByText('Camiseta:')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('Vegetariano:')).toBeInTheDocument();
    expect(screen.getByText('Sim')).toBeInTheDocument();
    // campo vazio (f3) não renderiza
    expect(screen.queryByText('Observação:')).not.toBeInTheDocument();
  });

  it('renderiza campo file como link "Ver arquivo"', () => {
    const fields: RegistrationField[] = [
      { id: 'doc', label: 'Comprovante', type: 'file' } as RegistrationField,
    ];
    render(
      <RegistrationCard
        registration={registration({ answers: { doc: 'https://x/file.pdf' } })}
        fields={fields}
      />,
    );
    const link = screen.getByRole('link', { name: 'Ver arquivo' });
    expect(link).toHaveAttribute('href', 'https://x/file.pdf');
  });

  it('junta respostas de array (multi_select) com vírgula', () => {
    const fields: RegistrationField[] = [
      { id: 'm', label: 'Dias', type: 'multi_select' } as RegistrationField,
    ];
    render(
      <RegistrationCard
        registration={registration({ answers: { m: ['Sáb', 'Dom'] } })}
        fields={fields}
      />,
    );
    expect(screen.getByText('Sáb, Dom')).toBeInTheDocument();
  });
});
