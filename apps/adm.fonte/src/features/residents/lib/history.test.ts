import { describe, expect, it } from 'vitest';
import type { StaffServicePeriod } from '@fonte/types';
import type { Admission } from '@fonte/api-client';
import { buildHistory } from './history';

const admission = (id: string, entryDate: string | null, exitDate: string | null) =>
  ({ id, entryDate, exitDate, status: 'DISCHARGED' }) as Admission;
const period = (id: string, startDate: string, endDate: string | null) =>
  ({ id, staffId: 's1', houseId: null, startDate, endDate, createdAt: '', updatedAt: '' }) as StaffServicePeriod;

describe('buildHistory (stories 215/216)', () => {
  it('só acolhimentos: mantém a ordem do backend e numera do mais antigo', () => {
    const items = buildHistory([admission('a2', '2024-01-01', null), admission('a1', '2020-01-01', '2020-06-01')]);
    expect(items.map((i) => [i.kind, i.title])).toEqual([
      ['admission', 'Acolhimento 2'],
      ['admission', 'Acolhimento 1'],
    ]);
  });

  it('mistura acolhimentos e períodos por início desc; empate põe o serviço antes', () => {
    const items = buildHistory(
      [admission('a2', '2023-01-01', '2025-03-01'), admission('a1', '2020-01-01', '2020-06-01')],
      [period('p1', '2025-03-01', null), period('p0', '2021-01-01', '2022-01-01'), period('tie', '2023-01-01', '2023-02-01')],
    );
    expect(items.map((i) => i.key)).toEqual([
      'service-p1',
      'service-tie',
      'admission-a2',
      'service-p0',
      'admission-a1',
    ]);
    expect(items.find((i) => i.kind === 'service')?.title).toBe('Período de serviço');
  });

  it('servo direto: só períodos', () => {
    const items = buildHistory([], [period('p1', '2025-03-01', null)]);
    expect(items).toEqual([expect.objectContaining({ kind: 'service', key: 'service-p1', startDate: '2025-03-01' })]);
  });

  it('acolhimento sem entrada vai para o fim', () => {
    const items = buildHistory([admission('legacy', null, null)], [period('p1', '2025-03-01', null)]);
    expect(items.map((i) => i.key)).toEqual(['service-p1', 'admission-legacy']);
  });
});
