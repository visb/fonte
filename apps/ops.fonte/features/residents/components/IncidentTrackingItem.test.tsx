import { render, screen } from '@testing-library/react-native';
import { IncidentCategory, IncidentType } from '@fonte/types';
import { outboxEntityId } from '@/lib/offline/outbox';
import { IncidentTrackingItem } from './IncidentTrackingItem';
import { TrackingTimelineItem } from './TrackingTimelineItem';
import type { TrackingIncident } from '../lib/trackingTimeline';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const base: TrackingIncident = {
  id: 'i1',
  date: '2026-03-12',
  type: IncidentType.NEGATIVE,
  category: IncidentCategory.AGGRESSION,
  description: 'Briga no refeitório, descrição completa sem corte de linhas.',
  houseId: 'h1',
  responsible: { id: 's1', name: 'Servo Pedro' },
  residents: [{ id: 'r1', name: 'João' }],
};

const formattedDate = new Date('2026-03-12T00:00:00').toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

describe('IncidentTrackingItem (story 228)', () => {
  it('mostra título, tipo, categoria, descrição completa e rodapé data · responsável', () => {
    render(<IncidentTrackingItem incident={base} residentId="r1" />);
    expect(screen.getByText('Ocorrência')).toBeTruthy();
    expect(screen.getByText('icon:alert-circle-outline')).toBeTruthy();
    expect(screen.getByText('Negativa')).toBeTruthy();
    expect(screen.getByTestId('incident-category-label').props.children).toBe('Agressão/briga');
    const description = screen.getByText(base.description);
    expect(description.props.numberOfLines).toBeUndefined();
    expect(screen.getByText(`${formattedDate} · Servo Pedro`)).toBeTruthy();
  });

  it('positiva usa o badge positivo', () => {
    render(
      <IncidentTrackingItem
        incident={{ ...base, type: IncidentType.POSITIVE, category: IncidentCategory.GOOD_BEHAVIOR }}
        residentId="r1"
      />,
    );
    expect(screen.getByText('Positiva')).toBeTruthy();
    expect(screen.getByText('Bom comportamento')).toBeTruthy();
  });

  it('sem "Com:" quando o filho é o único envolvido', () => {
    render(<IncidentTrackingItem incident={base} residentId="r1" />);
    expect(screen.queryByText(/^Com:/)).toBeNull();
  });

  it('"Com:" lista todos os outros filhos, sem repetir o próprio', () => {
    const incident = {
      ...base,
      residents: [
        { id: 'r2', name: 'Pedro' },
        { id: 'r1', name: 'João' },
        { id: 'r3', name: 'Lucas' },
        { id: 'r4', name: 'Marcos' },
        { id: 'r5', name: 'Tiago' },
      ],
    };
    render(<IncidentTrackingItem incident={incident} residentId="r1" />);
    expect(screen.getByText('Com: Pedro, Lucas, Marcos, Tiago')).toBeTruthy();
  });

  it('cache antigo sem tipo/categoria/residents/responsável não quebra', () => {
    const legacy = {
      ...base,
      type: undefined,
      category: undefined,
      residents: undefined,
      responsible: undefined,
    } as unknown as TrackingIncident;
    render(<IncidentTrackingItem incident={legacy} residentId="r1" />);
    expect(screen.getByText('Negativa')).toBeTruthy();
    expect(screen.getByText('Sem categoria')).toBeTruthy();
    expect(screen.getByText(formattedDate)).toBeTruthy();
    expect(screen.queryByTestId('pending-sync-badge')).toBeNull();
  });

  it('item da fila mostra o PendingBadge', () => {
    render(
      <IncidentTrackingItem incident={{ ...base, id: outboxEntityId('chave-1') }} residentId="r1" />,
    );
    expect(screen.getByTestId('pending-sync-badge')).toBeTruthy();
  });
});

describe('TrackingTimelineItem (story 228)', () => {
  it('ocorrência renderiza IncidentTrackingItem', () => {
    render(
      <TrackingTimelineItem
        entry={{ kind: 'incident', key: 'incident:i1', date: base.date, incident: base }}
        residentId="r1"
      />,
    );
    expect(screen.getByTestId('incident-tracking-item')).toBeTruthy();
  });
});
