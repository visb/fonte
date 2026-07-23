import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { FamilyInvestment } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }] }),
}));

const readmitState = { mutate: vi.fn(), isPending: false, isError: false, error: null as unknown };
const identityState = { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null as unknown };
vi.mock('../hooks/useResidents', () => ({
  useReadmitResident: () => readmitState,
  useUpdateResidentIdentity: () => identityState,
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
