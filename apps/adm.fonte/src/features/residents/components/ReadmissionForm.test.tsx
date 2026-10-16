import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ADMISSION_DATE_MESSAGES, FamilyInvestment } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }] }),
}));

const readmitState = { mutate: vi.fn(), isPending: false, isError: false, error: null as unknown };
const identityState = { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null as unknown };
// Story 203: histórico de passagens (a última saída limita a nova entrada).
let admissionsData: Array<{ exitDate: string | null }> | undefined = [];
vi.mock('../hooks/useResidents', () => ({
  useReadmitResident: () => readmitState,
  useUpdateResidentIdentity: () => identityState,
  useResidentAdmissions: () => ({ data: admissionsData }),
}));

let authRole: string | null = 'COORDINATOR';
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ role: authRole }),
}));

vi.mock('@/components/AvatarUpload', () => ({
  AvatarUpload: () => <div data-testid="avatar-upload" />,
}));

const createFollowUp = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    photoUrl: (u: string) => u,
    residents: { createFollowUp: (...a: unknown[]) => createFollowUp(...a) },
  },
}));

import { ReadmissionForm } from './ReadmissionForm';

const resident = {
  id: 'r1', name: 'Fulano de Tal', cpf: '12345678900', rg: '123456', birthDate: '1990-05-10',
  gender: 'MALE', address: 'Rua A', contactPhone: '11999998888', email: 'f@x.com',
} as unknown as Resident;

function renderForm() {
  const onBack = vi.fn();
  const onSuccess = vi.fn();
  render(<ReadmissionForm resident={resident} onBack={onBack} onSuccess={onSuccess} />);
  return { onBack, onSuccess };
}

beforeEach(() => {
  vi.clearAllMocks();
  authRole = 'COORDINATOR';
  admissionsData = [];
  readmitState.mutate = vi.fn();
  readmitState.isPending = false;
  readmitState.isError = false;
  readmitState.error = null;
});
afterEach(() => cleanup());

describe('ReadmissionForm', () => {
  it('mostra a identidade imutável do residente', () => {
    renderForm();
    expect(screen.getByText('Reintrodução de acolhido')).toBeInTheDocument();
    expect(screen.getByText('Fulano de Tal')).toBeInTheDocument();
    expect(screen.getByText('Masculino')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-upload')).toBeInTheDocument();
  });

  it('mostra o CPF completo formatado quando o backend entrega o dígito cru (ADMIN/COORDINATOR)', () => {
    renderForm();
    // resident.cpf = '12345678900' → displayCpf → formatado, nunca truncado
    expect(screen.getByText('123.456.789-00')).toBeInTheDocument();
    expect(screen.getByText('12.345.6')).toBeInTheDocument(); // rg '123456'
  });

  it('mostra o CPF/RG redigidos as-is para SERVANT (nunca 789.00)', () => {
    const redacted = {
      ...(resident as object),
      cpf: '***.***.789-00',
      rg: '***56',
    } as unknown as Resident;
    const onBack = vi.fn();
    const onSuccess = vi.fn();
    render(<ReadmissionForm resident={redacted} onBack={onBack} onSuccess={onSuccess} />);
    expect(screen.getByText('***.***.789-00')).toBeInTheDocument();
    expect(screen.getByText('***56')).toBeInTheDocument();
    expect(screen.queryByText('789.00')).not.toBeInTheDocument();
  });

  it('bloqueia o submit sem casa selecionada', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Reintroduzir acolhido/ }));
    expect(await screen.findByText('Casa é obrigatória')).toBeInTheDocument();
    expect(readmitState.mutate).not.toHaveBeenCalled();
  });

  it('submit válido muta com payload normalizado', async () => {
    readmitState.mutate.mockImplementation((_v, opts) => opts.onSuccess({ id: 'r1' }));
    const { onSuccess } = renderForm();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /Reintroduzir acolhido/ }));
    await waitFor(() => expect(readmitState.mutate).toHaveBeenCalled());
    expect(readmitState.mutate.mock.calls[0][0].data.houseId).toBe('h1');
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('r1'));
    // sem primeira mensalidade marcada → não cria follow-up
    expect(createFollowUp).not.toHaveBeenCalled();
  });

  it('data de entrada digitada no DateInput vai como YYYY-MM-DD (story 201)', async () => {
    readmitState.mutate.mockImplementation((_v, opts) => opts.onSuccess({ id: 'r1' }));
    renderForm();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'h1' } });
    fireEvent.change(screen.getByPlaceholderText('dd/mm/aaaa'), { target: { value: '03/09/2026' } });
    fireEvent.click(screen.getByRole('button', { name: /Reintroduzir acolhido/ }));
    await waitFor(() => expect(readmitState.mutate).toHaveBeenCalled());
    expect(readmitState.mutate.mock.calls[0][0].data.entryDate).toBe('2026-09-03');
  });

  describe('datas (story 203)', () => {
    const typeEntry = (value: string) =>
      fireEvent.change(screen.getByPlaceholderText('dd/mm/aaaa'), { target: { value } });
    const submit = () => {
      fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'h1' } });
      fireEvent.click(screen.getByRole('button', { name: /Reintroduzir acolhido/ }));
    };

    it('entrada antes da última saída → erro na entrada, sem mutation', async () => {
      admissionsData = [{ exitDate: '2025-03-01' }, { exitDate: '2026-02-10T00:00:00.000Z' }];
      renderForm();
      typeEntry('09/02/2026');
      submit();
      expect(
        await screen.findByText(ADMISSION_DATE_MESSAGES.entryBeforePreviousExit('2026-02-10')),
      ).toBeInTheDocument();
      expect(readmitState.mutate).not.toHaveBeenCalled();
    });

    it('entrada = última saída passa', async () => {
      admissionsData = [{ exitDate: '2026-02-10' }];
      renderForm();
      typeEntry('10/02/2026');
      submit();
      await waitFor(() => expect(readmitState.mutate).toHaveBeenCalled());
    });

    it('entrada futura → erro', async () => {
      admissionsData = undefined;
      renderForm();
      typeEntry('01/01/2999');
      submit();
      expect(await screen.findByText(ADMISSION_DATE_MESSAGES.entryFuture)).toBeInTheDocument();
      expect(readmitState.mutate).not.toHaveBeenCalled();
    });

    it('usa a saída da ficha quando o histórico ainda não carregou', async () => {
      admissionsData = undefined;
      const onSuccess = vi.fn();
      render(
        <ReadmissionForm
          resident={{ ...(resident as object), exitDate: '2026-05-05' } as unknown as Resident}
          onBack={vi.fn()}
          onSuccess={onSuccess}
        />,
      );
      typeEntry('04/05/2026');
      submit();
      expect(
        await screen.findByText(ADMISSION_DATE_MESSAGES.entryBeforePreviousExit('2026-05-05')),
      ).toBeInTheDocument();
    });
  });

  it('investimento NEGOTIATED revela o campo de valor e o checkbox de 1ª mensalidade', () => {
    renderForm();
    const selects = screen.getAllByRole('combobox');
    const investSelect = selects[selects.length - 1];
    fireEvent.change(investSelect, { target: { value: FamilyInvestment.NEGOTIATED } });
    expect(screen.getByText('Valor negociado (R$)')).toBeInTheDocument();
    expect(screen.getByText('Primeira mensalidade já foi paga')).toBeInTheDocument();
  });

  it('marca 1ª mensalidade e cria follow-up no sucesso', async () => {
    readmitState.mutate.mockImplementation((_v, opts) => opts.onSuccess({ id: 'r1' }));
    createFollowUp.mockResolvedValue({});
    renderForm();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'h1' } });
    fireEvent.change(selects[selects.length - 1], { target: { value: FamilyInvestment.BASKET_500 } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Reintroduzir acolhido/ }));
    await waitFor(() => expect(createFollowUp).toHaveBeenCalled());
  });

  it('mostra erro quando a mutation falha', () => {
    readmitState.isError = true;
    readmitState.error = new Error('boom');
    renderForm();
    expect(screen.getByText(/Erro ao reintroduzir acolhido|boom/)).toBeInTheDocument();
  });

  it('botão Editar (identidade) aparece só para ADMIN', () => {
    authRole = 'ADMIN';
    renderForm();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('botão Editar não aparece para COORDINATOR', () => {
    authRole = 'COORDINATOR';
    renderForm();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('botão Editar não aparece para SERVANT', () => {
    authRole = 'SERVANT';
    renderForm();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('clicar em Editar abre o dialog de correção de identidade', () => {
    authRole = 'ADMIN';
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByText('Corrigir dados de identificação')).toBeInTheDocument();
  });

  it('cancelar e voltar disparam onBack', () => {
    const { onBack } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});
