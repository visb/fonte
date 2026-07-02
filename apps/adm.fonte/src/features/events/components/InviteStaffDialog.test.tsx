import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Event, Staff } from '@fonte/api-client';

// Estados controláveis por teste (hooks mockados — dialog autossuficiente).
let staffState: Record<string, unknown>;
let mutationState: Record<string, unknown>;

vi.mock('@/features/staff/hooks/useStaff', () => ({
  useStaff: () => staffState,
}));
vi.mock('../hooks/useEvents', () => ({
  useInviteEventStaff: () => mutationState,
}));

import { InviteStaffDialog } from './InviteStaffDialog';

const event = { id: 'e1', title: 'Retiro' } as Event;

function makeStaff(id: string, overrides: Partial<Staff> = {}): Staff {
  return {
    id,
    name: `Servo ${id}`,
    whatsapp: '11977773000',
    houseId: 'h1',
    house: { id: 'h1', name: 'Casa A' },
    ...overrides,
  } as Staff;
}

const staffList = [
  makeStaff('s1'),
  makeStaff('s2', { houseId: 'h2', house: { id: 'h2', name: 'Casa B' } }),
  makeStaff('s3', { whatsapp: null }),
];

beforeEach(() => {
  vi.clearAllMocks();
  staffState = { data: staffList, isLoading: false, error: null, refetch: vi.fn() };
  mutationState = {
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
  };
});
afterEach(() => cleanup());

describe('InviteStaffDialog', () => {
  it('lista os servos com casa e aviso de "sem WhatsApp"', () => {
    render(<InviteStaffDialog open event={event} onClose={vi.fn()} />);
    expect(screen.getAllByTestId('invite-staff-row')).toHaveLength(3);
    expect(screen.getByText('Servo s3')).toBeInTheDocument();
    expect(screen.getByText('sem WhatsApp')).toBeInTheDocument();
    // Sem seleção, o envio fica desabilitado.
    expect(screen.getByRole('button', { name: /Enviar convites/ })).toBeDisabled();
  });

  it('filtra por casa', () => {
    render(<InviteStaffDialog open event={event} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Filtrar por casa'), { target: { value: 'h2' } });
    expect(screen.getAllByTestId('invite-staff-row')).toHaveLength(1);
    expect(screen.getByText('Servo s2')).toBeInTheDocument();
  });

  it('"Selecionar todos" marca os filtrados e o submit envia os ids', () => {
    render(<InviteStaffDialog open event={event} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }));
    const submit = screen.getByRole('button', { name: 'Enviar convites (3)' });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    const sentIds = (mutationState.mutate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect([...sentIds].sort()).toEqual(['s1', 's2', 's3']);
    // Com todos marcados o botão vira "Limpar seleção".
    expect(screen.getByRole('button', { name: 'Limpar seleção' })).toBeInTheDocument();
  });

  it('seleção individual via checkbox', () => {
    render(<InviteStaffDialog open event={event} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Servo s1'));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convites (1)' }));
    expect(mutationState.mutate).toHaveBeenCalledWith(['s1']);
  });

  it('sucesso mostra o resumo enviados/pulados com motivo', () => {
    mutationState.isSuccess = true;
    mutationState.data = {
      sent: ['s1'],
      skipped: [
        { staffId: 's3', reason: 'NO_WHATSAPP' },
        { staffId: 'ghost', reason: 'NOT_FOUND' },
      ],
    };
    render(<InviteStaffDialog open event={event} onClose={vi.fn()} />);
    expect(screen.getByTestId('invite-summary')).toHaveTextContent(
      '1 convite(s) enviado(s), 2 pulado(s).',
    );
    expect(screen.getByText(/Servo s3 — sem WhatsApp cadastrado/)).toBeInTheDocument();
    // Id desconhecido cai no fallback do próprio id.
    expect(screen.getByText(/ghost — servo não encontrado/)).toBeInTheDocument();
  });

  it('erro da mutation aparece via getErrorMessage', () => {
    mutationState.isError = true;
    mutationState.error = { response: { data: { message: 'boom' } } };
    render(<InviteStaffDialog open event={event} onClose={vi.fn()} />);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('fechar reseta a mutation e chama onClose', () => {
    const onClose = vi.fn();
    render(<InviteStaffDialog open event={event} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(mutationState.reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('estados de loading e vazio', () => {
    staffState = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { unmount } = render(<InviteStaffDialog open event={event} onClose={vi.fn()} />);
    expect(screen.queryAllByTestId('invite-staff-row')).toHaveLength(0);
    unmount();

    staffState = { data: [], isLoading: false, error: null, refetch: vi.fn() };
    render(<InviteStaffDialog open event={event} onClose={vi.fn()} />);
    expect(screen.getByText('Nenhum servo cadastrado.')).toBeInTheDocument();
  });

  it('estado de erro ao carregar servos', () => {
    staffState = {
      data: undefined,
      isLoading: false,
      error: { response: { data: { message: 'offline' } } },
      refetch: vi.fn(),
    };
    render(<InviteStaffDialog open event={event} onClose={vi.fn()} />);
    expect(screen.getByText('offline')).toBeInTheDocument();
  });
});
