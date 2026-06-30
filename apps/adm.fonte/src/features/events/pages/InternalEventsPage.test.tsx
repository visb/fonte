import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Event } from '@fonte/api-client';
import { EventAudience } from '@fonte/api-client';

vi.mock('../hooks/useEvents', () => ({
  useInternalEvents: vi.fn(),
}));

import { useInternalEvents } from '../hooks/useEvents';
import { InternalEventsPage } from './InternalEventsPage';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'i1',
    title: 'Reunião de servos',
    description: 'Pauta da semana',
    startAt: '2026-09-01T13:00:00.000Z',
    endAt: null,
    location: 'Sede',
    audience: EventAudience.INTERNAL,
    capacity: null,
    registrationEnabled: false,
    paymentEnabled: false,
    priceCents: null,
    registrationFields: [],
    bannerUrl: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  } as Event;
}

const mocked = vi.mocked(useInternalEvents);

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('InternalEventsPage', () => {
  it('renderiza a lista de eventos internos', () => {
    mocked.mockReturnValue({
      data: [makeEvent()],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    render(<InternalEventsPage />);
    expect(screen.getByTestId('internal-events-list')).toBeInTheDocument();
    expect(screen.getByText('Reunião de servos')).toBeInTheDocument();
    expect(screen.getByText('Interno')).toBeInTheDocument();
  });

  it('mostra estado de carregamento', () => {
    mocked.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as never);
    const { container } = render(<InternalEventsPage />);
    expect(container).toBeTruthy();
    expect(screen.queryByTestId('internal-events-list')).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando não há eventos internos', () => {
    mocked.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    render(<InternalEventsPage />);
    expect(screen.getByText('Nenhum evento interno agendado.')).toBeInTheDocument();
  });

  it('mostra estado de erro', () => {
    mocked.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('falhou'),
      refetch: vi.fn(),
    } as never);
    render(<InternalEventsPage />);
    expect(screen.getByText(/Erro ao carregar eventos internos/)).toBeInTheDocument();
  });
});
