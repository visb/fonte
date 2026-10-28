import { render, screen } from '@testing-library/react-native';
import { outboxEntityId } from '@/lib/offline/outbox';
import { IncidentCard } from './IncidentCard';

// Story 229: o badge do tipo usa Ionicons (fonte nativa não carrega no jest).
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const base = {
  date: '2026-08-10',
  type: 'NEGATIVE',
  description: 'briga no pátio',
  responsible: { name: 'Irmão João' },
  residents: [],
};

describe('IncidentCard — ocorrência registrada sem sinal (story 171)', () => {
  it('marca como pendente enquanto está na fila', () => {
    render(<IncidentCard item={{ ...base, id: outboxEntityId('chave-1') }} />);

    expect(screen.getByTestId('pending-sync-badge')).toBeTruthy();
    expect(screen.getByText('briga no pátio')).toBeTruthy();
  });

  it('ocorrência já no servidor não leva selo', () => {
    render(<IncidentCard item={{ ...base, id: 'inc-1' }} />);

    expect(screen.queryByTestId('pending-sync-badge')).toBeNull();
  });
});
