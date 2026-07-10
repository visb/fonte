import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { FamilyInvestment } from '@fonte/types';
import type { House } from '@fonte/api-client';
import {
  ResidentFichaSections,
  ResidentAdmissionSections,
} from './ResidentFormSections';

const houses = [{ id: 'h1', name: 'Casa Belém' }] as House[];

function FichaHarness() {
  const { register, formState: { errors } } = useForm();
  return <form><ResidentFichaSections register={register as never} errors={errors as never} /></form>;
}

function AdmissionHarness(props: Partial<Parameters<typeof ResidentAdmissionSections>[0]>) {
  const { register, formState: { errors } } = useForm();
  return (
    <form>
      <ResidentAdmissionSections
        register={register as never}
        errors={errors as never}
        houses={houses}
        {...props}
      />
    </form>
  );
}

afterEach(() => cleanup());

describe('ResidentFichaSections', () => {
  it('renderiza os dados pessoais com placeholder do acolhido', () => {
    render(<FichaHarness />);
    expect(screen.getByPlaceholderText('Nome do acolhido')).toBeInTheDocument();
    expect(screen.getByText('Identificação')).toBeInTheDocument();
  });
});

describe('ResidentAdmissionSections', () => {
  it('mostra investimento, casa e data de entrada', () => {
    render(<AdmissionHarness />);
    expect(screen.getByText('Investimento')).toBeInTheDocument();
    expect(screen.getByText('Casa *')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
  });

  it('NEGOTIATED revela o campo de valor negociado', () => {
    render(<AdmissionHarness watchFamilyInvestment={FamilyInvestment.NEGOTIATED} />);
    expect(screen.getByText('Valor negociado (R$)')).toBeInTheDocument();
  });

  it('SOCIAL oculta o dia de vencimento', () => {
    render(<AdmissionHarness watchFamilyInvestment={FamilyInvestment.SOCIAL} />);
    expect(screen.queryByText('Dia de vencimento da contribuição')).not.toBeInTheDocument();
  });

  it('showStatus exibe o seletor de status', () => {
    render(<AdmissionHarness showStatus />);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('não mostra a data de saída por padrão', () => {
    render(<AdmissionHarness />);
    expect(screen.queryByText('Data de saída')).not.toBeInTheDocument();
  });

  it('showExitDate exibe o campo de data de saída (import, story 120)', () => {
    render(<AdmissionHarness showExitDate />);
    expect(screen.getByText('Data de saída')).toBeInTheDocument();
    expect(screen.getByText(/o status Alta\/Evasão/)).toBeInTheDocument();
  });

  it('first payment: mostra checkbox e dispara onFirstPaymentChange', () => {
    const onChange = vi.fn();
    render(
      <AdmissionHarness
        showFirstPayment
        watchFamilyInvestment={FamilyInvestment.PAYMENT_700}
        onFirstPaymentChange={onChange}
      />,
    );
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('first payment pago exibe o slot fornecido', () => {
    render(
      <AdmissionHarness
        showFirstPayment
        watchFamilyInvestment={FamilyInvestment.PAYMENT_700}
        firstPaymentPaid
        firstPaymentSlot={<div data-testid="payment-slot" />}
      />,
    );
    expect(screen.getByTestId('payment-slot')).toBeInTheDocument();
  });
});
