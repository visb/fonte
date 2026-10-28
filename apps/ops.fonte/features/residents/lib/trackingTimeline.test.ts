import { FollowUpType, IncidentCategory, IncidentType } from '@fonte/types';
import type { ResidentFollowUp } from '@fonte/api-client';
import { mergeTrackingTimeline, type TrackingIncident } from './trackingTimeline';

function followUp(id: string, date: string, createdAt: string): ResidentFollowUp {
  return {
    id,
    residentId: 'r1',
    date,
    type: FollowUpType.NOTE,
    description: null,
    accessLevel: 'ALL' as ResidentFollowUp['accessLevel'],
    attachmentUrl: null,
    createdById: null,
    createdByName: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function incident(id: string, date: string, createdAt?: string): TrackingIncident {
  return {
    id,
    date,
    type: IncidentType.NEGATIVE,
    category: IncidentCategory.OTHER,
    description: 'x',
    houseId: 'h1',
    responsible: { id: 's1', name: 'Servo' },
    residents: [{ id: 'r1', name: 'João' }],
    ...(createdAt ? { createdAt } : {}),
  };
}

const keys = (entries: ReturnType<typeof mergeTrackingTimeline>) => entries.map((e) => e.key);

describe('mergeTrackingTimeline (story 228)', () => {
  it('listas vazias/ausentes viram linha do tempo vazia', () => {
    expect(mergeTrackingTimeline([], [])).toEqual([]);
    expect(mergeTrackingTimeline(undefined, undefined)).toEqual([]);
  });

  it('só follow-ups ou só ocorrências', () => {
    expect(keys(mergeTrackingTimeline([followUp('f1', '2026-01-01', 'a')], undefined))).toEqual([
      'follow-up:f1',
    ]);
    expect(keys(mergeTrackingTimeline(undefined, [incident('i1', '2026-01-01', 'a')]))).toEqual([
      'incident:i1',
    ]);
  });

  it('intercala por date desc', () => {
    const result = mergeTrackingTimeline(
      [followUp('f1', '2026-03-01', '2026-03-01T10:00:00Z'), followUp('f2', '2026-01-01', '2026-01-01T10:00:00Z')],
      [incident('i1', '2026-02-01', '2026-02-01T10:00:00Z'), incident('i2', '2026-04-01', '2026-04-01T10:00:00Z')],
    );
    expect(keys(result)).toEqual(['incident:i2', 'follow-up:f1', 'incident:i1', 'follow-up:f2']);
    expect(result[0]).toMatchObject({ kind: 'incident', incident: { id: 'i2' } });
    expect(result[1]).toMatchObject({ kind: 'followUp', followUp: { id: 'f1' } });
  });

  it('mesmo dia desempata por createdAt desc entre tipos', () => {
    const result = mergeTrackingTimeline(
      [followUp('f1', '2026-03-01', '2026-03-01T08:00:00Z'), followUp('f2', '2026-03-01', '2026-03-01T20:00:00Z')],
      [incident('i1', '2026-03-01', '2026-03-01T12:00:00Z')],
    );
    expect(keys(result)).toEqual(['follow-up:f2', 'incident:i1', 'follow-up:f1']);
  });

  it('data com horário (ISO completo) compara pelo dia', () => {
    const result = mergeTrackingTimeline(
      [followUp('f1', '2026-03-01', '2026-03-01T23:00:00Z')],
      [incident('i1', '2026-03-01T00:00:00.000Z', '2026-03-01T01:00:00Z')],
    );
    expect(keys(result)).toEqual(['follow-up:f1', 'incident:i1']);
  });

  it('item pendente da fila (sem createdAt) é o mais recente do dia', () => {
    const result = mergeTrackingTimeline(
      [followUp('f1', '2026-03-01', '2026-03-01T23:00:00Z')],
      [incident('pending', '2026-03-01')],
    );
    expect(keys(result)).toEqual(['incident:pending', 'follow-up:f1']);
    const reversed = mergeTrackingTimeline(undefined, [
      incident('old', '2026-03-01', '2026-03-01T01:00:00Z'),
      incident('pending', '2026-03-01'),
    ]);
    expect(keys(reversed)).toEqual(['incident:pending', 'incident:old']);
  });

  it('empate total mantém follow-up antes de ocorrência (sort estável)', () => {
    const result = mergeTrackingTimeline(
      [followUp('f1', '2026-03-01', 'same')],
      [incident('i1', '2026-03-01', 'same')],
    );
    expect(keys(result)).toEqual(['follow-up:f1', 'incident:i1']);
  });
});
