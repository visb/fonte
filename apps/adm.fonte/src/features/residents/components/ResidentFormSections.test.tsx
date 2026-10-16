import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { FamilyInvestment, todayInSaoPaulo } from '@fonte/types';
import type { House } from '@fonte/api-client';
import {
  ResidentFichaSections,
  ResidentAdmissionSections,
} from './ResidentFormSections';

const houses = [{ id: 'h1', name: 'Casa Belém' }] as House[];

function FichaHarness() {
  const { register, control, formState: { errors } } = useForm();
  return (
    <form>
      <ResidentFichaSections
        register={register as never}
        control={control as never}
        errors={errors as never}
      />
    </form>
  );
}

type AdmissionProps = Partial<Parameters<typeof ResidentAdmissionSections>[0]> & {
  onSubmit?: (values: Record<string, unknown>) => void;
  defaults?: { entryDate: string; exitDate: string };
};

function AdmissionHarness({ onSubmit, defaults, ...props }: AdmissionProps) {
  const { register, control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: defaults ?? { entryDate: '2026-01-10', exitDate: '' },
  });
  return (
    <form onSubmit={handleSubmit((v) => onSubmit?.(v))}>
      <ResidentAdmissionSections
        register={register as never}
        control={control as never}
        errors={errors as never}
        houses={houses}
        {...props}
      />
      <button type="submit">Salvar</button>
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

  it('datas de entrada e saída pelo DateInput enviam YYYY-MM-DD (story 201)', async () => {
    const onSubmit = vi.fn();
    render(<AdmissionHarness showExitDate onSubmit={onSubmit} />);
    expect(document.querySelector('input[type="date"]')).toBeNull();
    const entry = document.querySelector('input[name="entryDate"]') as HTMLInputElement;
    const exit = document.querySelector('input[name="exitDate"]') as HTMLInputElement;
    expect(entry.value).toBe('10/01/2026');
    fireEvent.change(entry, { target: { value: '05/02/2026' } });
    fireEvent.change(exit, { target: { value: '20/03/2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      entryDate: '2026-02-05',
      exitDate: '2026-03-20',
    });
  });

  // Story 203: entrada até hoje; saída entre a entrada e hoje.
  describe('limites do calendário (story 203)', () => {
    const dayButton = (iso: string) =>
      document.querySelector(`[data-day="${iso}"] button`) as HTMLButtonElement | null;
    const openCalendar = async (name: string) => {
      await act(() => new Promise((r) => setTimeout(r, 0)));
      fireEvent.focus(document.querySelector(`input[name="${name}"]`) as HTMLInputElement);
      await screen.findByRole('grid');
    };

    it('saída: dias antes da entrada ficam desabilitados', async () => {
      render(<AdmissionHarness showExitDate defaults={{ entryDate: '2026-01-10', exitDate: '2026-01-15' }} />);
      await openCalendar('exitDate');
      expect(dayButton('2026-01-09')).toBeDisabled();
      expect(dayButton('2026-01-10')).toBeEnabled();
    });

    it('entrada: amanhã fica desabilitado, hoje não', async () => {
      const today = todayInSaoPaulo();
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      const tomorrow = d.toISOString().slice(0, 10);
      render(<AdmissionHarness defaults={{ entryDate: today, exitDate: '' }} />);
      await openCalendar('entryDate');
      expect(dayButton(today)).toBeEnabled();
      if (tomorrow.slice(0, 7) === today.slice(0, 7)) {
        expect(dayButton(tomorrow)).toBeDisabled();
      }
    });
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
