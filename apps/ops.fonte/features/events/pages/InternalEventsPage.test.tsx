import { render, screen } from '@testing-library/react-native';
import type { Event } from '@fonte/api-client';
import { EventAudience } from '@fonte/api-client';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

const mockResult = {
  data: [] as Event[],
  isLoading: false,
  error: null as unknown,
  refetch: jest.fn(),
};

jest.mock('../hooks/useInternalEvents', () => ({
  useInternalEvents: () => mockResult,
}));

import { InternalEventsPage } from './InternalEventsPage';
import { EventCard, formatEventDate } from '../components/EventCard';

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

beforeEach(() => {
  mockResult.data = [];
  mockResult.isLoading = false;
  mockResult.error = null;
});

describe('InternalEventsPage (ops)', () => {
  it('renderiza os cards de eventos internos', () => {
    mockResult.data = [makeEvent()];
    render(<InternalEventsPage />);
    expect(screen.getByText('Reunião de servos')).toBeTruthy();
    expect(screen.getByTestId('internal-event-card')).toBeTruthy();
  });

  it('mostra estado vazio quando não há eventos', () => {
    mockResult.data = [];
    render(<InternalEventsPage />);
    expect(screen.getByText('Nenhum evento interno agendado.')).toBeTruthy();
  });

  it('mostra estado de erro', () => {
    mockResult.error = new Error('falhou');
    render(<InternalEventsPage />);
    expect(screen.getByText('Erro ao carregar eventos internos.')).toBeTruthy();
  });
});

describe('EventCard (ops)', () => {
  it('mostra título, badge Interno e local', () => {
    render(<EventCard event={makeEvent()} />);
    expect(screen.getByText('Interno')).toBeTruthy();
    expect(screen.getByText('Reunião de servos')).toBeTruthy();
    expect(screen.getByText('Sede')).toBeTruthy();
  });

  it('formatEventDate inclui o fim quando presente', () => {
    const range = formatEventDate('2026-09-01T13:00:00.000Z', '2026-09-01T15:00:00.000Z');
    expect(range).toContain('—');
  });
});
