import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityEventType, ActivityStatus } from '@fonte/types';
import type { ActivityEvent } from '@fonte/api-client';
import { HistoryEventItem } from './HistoryEventItem';

function event(partial: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'evt-1',
    activityId: 'act-1',
    type: ActivityEventType.CREATED,
    actor: { id: 'staff-1', name: 'Maria da Silva', userId: 'user-1' },
    actorUserId: 'user-1',
    metadata: null,
    createdAt: '2026-06-20T12:00:00.000Z',
    ...partial,
  };
}

describe('HistoryEventItem', () => {
  it('mostra o ator e o label de criação', () => {
    render(<HistoryEventItem event={event()} />);
    expect(screen.getByText('Maria da Silva')).toBeInTheDocument();
    expect(screen.getByText('criou a atividade')).toBeInTheDocument();
  });

  it('descreve a mudança de status com os rótulos das colunas', () => {
    render(
      <HistoryEventItem
        event={event({
          type: ActivityEventType.STATUS_CHANGED,
          metadata: { from: ActivityStatus.TODO, to: ActivityStatus.DOING },
        })}
      />,
    );
    expect(screen.getByText('moveu de A fazer para Fazendo')).toBeInTheDocument();
  });

  it('renderiza o label de cada tipo de evento', () => {
    const cases: Array<[ActivityEventType, string]> = [
      [ActivityEventType.TITLE_CHANGED, 'alterou o título'],
      [ActivityEventType.DESCRIPTION_CHANGED, 'alterou a descrição'],
      [ActivityEventType.RESPONSIBLE_CHANGED, 'alterou o responsável'],
      [ActivityEventType.COMMENTED, 'comentou'],
      [ActivityEventType.DELETED, 'excluiu a atividade'],
    ];
    for (const [type, label] of cases) {
      const { unmount } = render(<HistoryEventItem event={event({ type })} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('cai para "Alguém" quando o ator não foi resolvido', () => {
    render(<HistoryEventItem event={event({ actor: null })} />);
    expect(screen.getByText('Alguém')).toBeInTheDocument();
  });
});
