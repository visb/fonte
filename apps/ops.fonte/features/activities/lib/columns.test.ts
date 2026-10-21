import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { ACTIVITY_COLUMNS } from '@/features/activities/constants';
import { groupActivitiesByStatus, initialActivityTab, parseActivityTab } from './columns';

function activity(id: string, status: ActivityStatus): Activity {
  return { id, title: id, status } as Activity;
}

describe('activities/lib/columns (story 208)', () => {
  it('distribui as atividades pelos 6 status na ordem de ACTIVITY_COLUMNS', () => {
    const columns = groupActivitiesByStatus([
      activity('a', ActivityStatus.DONE),
      activity('b', ActivityStatus.TODO),
      activity('c', ActivityStatus.TODO),
      activity('d', ActivityStatus.DRAFT),
    ]);

    expect(columns.map((c) => c.status)).toEqual(ACTIVITY_COLUMNS.map((c) => c.status));
    expect(columns.map((c) => c.title)).toEqual([
      'Rascunhos',
      'Solicitações',
      'A fazer',
      'Fazendo',
      'Impedimento',
      'Concluídas',
    ]);
    expect(columns.map((c) => c.data.map((a) => a.id))).toEqual([
      ['d'],
      [],
      ['b', 'c'],
      [],
      [],
      ['a'],
    ]);
  });

  it('a aba inicial é a primeira coluna com itens', () => {
    const columns = groupActivitiesByStatus([
      activity('a', ActivityStatus.DONE),
      activity('b', ActivityStatus.DOING),
    ]);
    expect(initialActivityTab(columns)).toBe(ActivityStatus.DOING);
  });

  it('tudo vazio abre em Rascunhos', () => {
    expect(initialActivityTab(groupActivitiesByStatus([]))).toBe(ActivityStatus.DRAFT);
  });

  it('parseActivityTab aceita só status de coluna (story 220)', () => {
    expect(parseActivityTab('DRAFT')).toBe(ActivityStatus.DRAFT);
    expect(parseActivityTab('DONE')).toBe(ActivityStatus.DONE);
    expect(parseActivityTab('nada')).toBeNull();
    expect(parseActivityTab(undefined)).toBeNull();
    expect(parseActivityTab(['DRAFT'])).toBeNull();
  });
});
