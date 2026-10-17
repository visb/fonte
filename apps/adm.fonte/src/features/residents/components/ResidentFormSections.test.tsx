import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { FamilyInvestment, todayInSaoPaulo } from '@fonte/types';
import type { House } from '@fonte/api-client';

// Story 205: ministérios da casa para o campo "Ministério".
const ministriesByHouse: Record<string, { id: string; name: string }[]> = {
  h1: [{ id: 'm1', name: 'Cozinha' }],
  h2: [{ id: 'm2', name: 'Horta' }],
};
const ministryHook = vi.fn((houseId: string, options?: { enabled?: boolean }) =>
  options?.enabled === false
    ? { data: undefined, isSuccess: false }
    : { data: ministriesByHouse[houseId] ?? [], isSuccess: true },
);
vi.mock('@/features/houses/hooks/useHouseMinistries', () => ({
  useHouseMinistriesList: (houseId: string, options?: { enabled?: boolean }) => ministryHook(houseId, options),
}));

import {
  ResidentFichaSections,
  ResidentAdmissionSections,
} from './ResidentFormSections';

const houses = [{ id: 'h1', name: 'Casa Belém' }, { id: 'h2', name: 'Casa Sião' }] as House[];

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
  defaults?: Record<string, string>;
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

  // ── Story 205: campo "Ministério" no acolhimento ──────────────────────────
  describe('campo Ministério (story 205)', () => {
    const ministrySelect = () => screen.queryByLabelText('Ministério') as HTMLSelectElement | null;

    it('sem casa escolhida, o campo não aparece', () => {
      render(<AdmissionHarness />);
      expect(ministrySelect()).toBeNull();
    });

    it('lista só os ministérios da casa e envia o ministryId', async () => {
      const onSubmit = vi.fn();
      render(<AdmissionHarness defaults={{ entryDate: '2026-01-10', exitDate: '', houseId: 'h1' }} onSubmit={onSubmit} />);
      const select = ministrySelect()!;
      expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Sem ministério', 'Cozinha']);
      fireEvent.change(select, { target: { value: 'm1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ houseId: 'h1', ministryId: 'm1' });
    });

    it('trocar a casa limpa o ministério da casa anterior', async () => {
      const onSubmit = vi.fn();
      render(
        <AdmissionHarness
          defaults={{ entryDate: '2026-01-10', exitDate: '', houseId: 'h1', ministryId: 'm1' }}
          onSubmit={onSubmit}
        />,
      );
      expect(ministrySelect()!.value).toBe('m1');
      fireEvent.change(screen.getByDisplayValue('Casa Belém'), { target: { value: 'h2' } });
      await waitFor(() => expect(ministrySelect()!.value).toBe(''));
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ houseId: 'h2', ministryId: '' });
    });

    it('filho fora de acolhimento (alta) não tem o campo e o valor é limpo', async () => {
      const onSubmit = vi.fn();
      render(
        <AdmissionHarness
          showStatus
          defaults={{ entryDate: '2026-01-10', exitDate: '', houseId: 'h1', ministryId: 'm1', status: 'DISCHARGED' }}
          onSubmit={onSubmit}
        />,
      );
      expect(ministrySelect()).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ ministryId: '' });
      expect(ministryHook).toHaveBeenCalledWith('h1', { enabled: false });
    });

    it.each(['ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE'])('status %s mostra o campo', (status) => {
      render(
        <AdmissionHarness showStatus defaults={{ entryDate: '2026-01-10', exitDate: '', houseId: 'h1', status }} />,
      );
      expect(ministrySelect()).not.toBeNull();
    });
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
