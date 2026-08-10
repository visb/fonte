import { render, screen } from '@testing-library/react-native';
import { outboxEntityId } from '@/lib/offline/outbox';
import { IncidentCard } from './IncidentCard';

const base = {
  date: '2026-08-10',
  severity: 'HIGH',
  description: 'briga no pátio',
  responsible: { name: 'Irmão João' },
  resident: null,
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
