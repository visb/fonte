import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { EventPaymentInfo } from '@fonte/types';
import { EventPaymentPage } from './EventPaymentPage';

const useEventPaymentByToken = vi.fn();
const usePayEvent = vi.fn();

vi.mock('../hooks/useEventPayment', () => ({
  useEventPaymentByToken: (token: string | undefined) => useEventPaymentByToken(token),
  usePayEvent: (token: string) => usePayEvent(token),
}));

function info(overrides: Partial<EventPaymentInfo> = {}): EventPaymentInfo {
  return {
    eventTitle: 'Retiro pago',
    amountCents: 5248,
    paymentStatus: 'PENDING' as EventPaymentInfo['paymentStatus'],
    paymentMethod: null,
    registrantName: 'Maria',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/pagamento/tok-1']}>
      <Routes>
        <Route path="/pagamento/:token" element={<EventPaymentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const idleMutation = { mutate: vi.fn(), isPending: false, error: null, isSuccess: false, data: undefined };

describe('EventPaymentPage (story 70)', () => {
  beforeEach(() => {
    usePayEvent.mockReturnValue(idleMutation);
  });

  it('mostra loading', () => {
    useEventPaymentByToken.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    renderPage();
    expect(screen.getByText(/carregando seu pagamento/i)).toBeInTheDocument();
  });

  it('token inválido mostra tela de erro', () => {
    useEventPaymentByToken.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    renderPage();
    expect(screen.getByRole('heading', { name: /link inválido ou expirado/i })).toBeInTheDocument();
  });

  it('PENDING mostra a escolha de método e o valor', () => {
    useEventPaymentByToken.mockReturnValue({ isLoading: false, isError: false, data: info() });
    renderPage();
    expect(screen.getByRole('heading', { name: 'Retiro pago' })).toBeInTheDocument();
    expect(screen.getByText('R$ 52,48')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartão de crédito' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PIX' })).toBeInTheDocument();
  });

  it('PAID mostra a confirmação', () => {
    useEventPaymentByToken.mockReturnValue({
      isLoading: false,
      isError: false,
      data: info({ paymentStatus: 'PAID' as EventPaymentInfo['paymentStatus'] }),
    });
    renderPage();
    expect(screen.getByRole('heading', { name: /pagamento confirmado/i })).toBeInTheDocument();
  });

  it('FAILED mostra aviso e permite tentar de novo', () => {
    useEventPaymentByToken.mockReturnValue({
      isLoading: false,
      isError: false,
      data: info({ paymentStatus: 'FAILED' as EventPaymentInfo['paymentStatus'] }),
    });
    renderPage();
    expect(screen.getByText(/pagamento anterior não foi concluído/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartão de crédito' })).toBeInTheDocument();
  });

  it('NONE mostra inscrição sem pagamento', () => {
    useEventPaymentByToken.mockReturnValue({
      isLoading: false,
      isError: false,
      data: info({ paymentStatus: 'NONE' as EventPaymentInfo['paymentStatus'] }),
    });
    renderPage();
    expect(screen.getByRole('heading', { name: /inscrição sem pagamento/i })).toBeInTheDocument();
  });
});
