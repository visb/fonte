import type { ConsentRecord, ConsentStatus } from '@fonte/api-client';
import { CONSENT_PURPOSES, mergeConsentStatuses } from './consents';

function record(over: Partial<ConsentRecord>): ConsentRecord {
  return {
    id: 'c1',
    subjectType: 'RESIDENT',
    subjectId: 'r1',
    purpose: 'IMAGE_PUBLICATION',
    granted: true,
    termVersion: '1.0',
    recordedByUserId: null,
    createdAt: '2026-08-10T10:00:00.000Z',
    ...over,
  };
}

describe('mergeConsentStatuses', () => {
  it('sem registro nenhum, toda finalidade nasce não concedida', () => {
    expect(mergeConsentStatuses(null, [])).toEqual(
      CONSENT_PURPOSES.map((purpose) => ({
        purpose,
        granted: false,
        termVersion: null,
        since: null,
      })),
    );
  });

  it('consolida pelo registro mais recente de cada finalidade (append-only)', () => {
    const statuses = mergeConsentStatuses(null, [
      record({ id: 'c1', granted: true, createdAt: '2026-08-01T10:00:00.000Z' }),
      record({ id: 'c2', granted: false, createdAt: '2026-08-05T10:00:00.000Z' }),
      record({
        id: 'c3',
        purpose: 'RELIGIOUS_DISCLOSURE',
        granted: true,
        createdAt: '2026-08-02T10:00:00.000Z',
      }),
    ]);

    expect(statuses).toEqual([
      {
        purpose: 'IMAGE_PUBLICATION',
        granted: false,
        termVersion: '1.0',
        since: '2026-08-05T10:00:00.000Z',
      },
      {
        purpose: 'RELIGIOUS_DISCLOSURE',
        granted: true,
        termVersion: '1.0',
        since: '2026-08-02T10:00:00.000Z',
      },
    ]);
  });

  it('delta só com uma finalidade preserva o estado guardado da outra', () => {
    const stored: ConsentStatus[] = [
      {
        purpose: 'IMAGE_PUBLICATION',
        granted: true,
        termVersion: '1.0',
        since: '2026-07-01T10:00:00.000Z',
      },
      {
        purpose: 'RELIGIOUS_DISCLOSURE',
        granted: true,
        termVersion: '1.0',
        since: '2026-07-01T10:00:00.000Z',
      },
    ];

    const statuses = mergeConsentStatuses(stored, [
      record({ purpose: 'IMAGE_PUBLICATION', granted: false, createdAt: '2026-08-09T10:00:00.000Z' }),
    ]);

    expect(statuses[0]).toMatchObject({ granted: false, since: '2026-08-09T10:00:00.000Z' });
    expect(statuses[1]).toEqual(stored[1]);
  });

  it('registro mais velho que o estado guardado não desfaz a decisão mais nova', () => {
    const stored: ConsentStatus[] = [
      {
        purpose: 'IMAGE_PUBLICATION',
        granted: false,
        termVersion: '1.0',
        since: '2026-08-10T10:00:00.000Z',
      },
    ];

    const statuses = mergeConsentStatuses(stored, [
      record({ granted: true, createdAt: '2026-07-01T10:00:00.000Z' }),
    ]);

    expect(statuses[0]).toEqual(stored[0]);
  });

  it('termo ausente vira null (a tela não inventa versão)', () => {
    const statuses = mergeConsentStatuses(null, [record({ termVersion: null })]);

    expect(statuses[0].termVersion).toBeNull();
  });
});
