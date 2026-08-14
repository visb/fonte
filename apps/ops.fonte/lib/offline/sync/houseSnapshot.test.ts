import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import type { HouseOfflineSnapshotResponse, Resident } from '@fonte/api-client';

jest.mock('@/lib/api', () => ({
  api: { offlineSync: { houseSnapshot: jest.fn() } },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { createWebDriver } from '../store/driver.asyncStorage';
import { setResidentStoreDriver } from '../store/driver';
import {
  lastSyncedAt,
  readHouseMinistries,
  readResident,
  readResidentDetail,
  readResidentList,
  saveResidentDetail,
  saveResidentList,
  setLastSyncedAt,
} from '../store/residentStore';
import { syncHouseSnapshot } from './houseSnapshot';

const houseSnapshot = api.offlineSync.houseSnapshot as jest.Mock;

function resident(id: string, name: string): Resident {
  return { id, name, houseId: 'h1', status: 'ACTIVE' } as unknown as Resident;
}

function followUp(id: string, residentId: string, date = '2026-08-10'): unknown {
  return {
    id,
    residentId,
    date,
    type: 'GENERAL',
    description: null,
    accessLevel: 'ALL',
    attachmentUrl: null,
    createdById: null,
    createdByName: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
  };
}

function snapshot(over: Partial<HouseOfflineSnapshotResponse> = {}): HouseOfflineSnapshotResponse {
  return {
    syncedAt: '2026-08-14T12:00:00.000Z',
    full: true,
    residents: [],
    followUps: {},
    consents: {},
    receivables: {},
    attachments: {},
    ministries: [],
    deleted: { residents: [], followUps: [], receivables: [] },
    ...over,
  } as HouseOfflineSnapshotResponse;
}

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  setResidentStoreDriver(createWebDriver());
});

afterEach(() => {
  jest.restoreAllMocks();
  setResidentStoreDriver(null);
});

describe('syncHouseSnapshot — o `since`', () => {
  it('primeira sincronização vai sem `since` (pede o pacote completo)', async () => {
    houseSnapshot.mockResolvedValue(snapshot());

    await syncHouseSnapshot(createClient(), 'h1');

    expect(houseSnapshot).toHaveBeenCalledWith('h1', undefined);
  });

  it('as seguintes mandam o `syncedAt` guardado', async () => {
    await setLastSyncedAt('h1', '2026-08-13T09:00:00.000Z');
    houseSnapshot.mockResolvedValue(snapshot({ full: false }));

    await syncHouseSnapshot(createClient(), 'h1');

    expect(houseSnapshot).toHaveBeenCalledWith('h1', '2026-08-13T09:00:00.000Z');
  });

  it('guarda o relógio do SERVIDOR, não o do aparelho', async () => {
    // Aparelho com a data errada — em campo isso acontece.
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2031-01-01T00:00:00.000Z').getTime());
    houseSnapshot.mockResolvedValue(snapshot({ syncedAt: '2026-08-14T12:00:00.000Z' }));

    await syncHouseSnapshot(createClient(), 'h1');

    expect(await lastSyncedAt('h1')).toBe('2026-08-14T12:00:00.000Z');
  });

  it('sem casa não chama nada', async () => {
    expect(await syncHouseSnapshot(createClient(), null)).toBeNull();
    expect(await syncHouseSnapshot(createClient(), undefined)).toBeNull();
    expect(houseSnapshot).not.toHaveBeenCalled();
  });
});

describe('syncHouseSnapshot — sincronização completa', () => {
  it('substitui o conteúdo da casa e grava a ficha inteira', async () => {
    await saveResidentList('h1', [resident('antigo', 'Filho Antigo')]);
    houseSnapshot.mockResolvedValue(
      snapshot({
        full: true,
        residents: [resident('r1', 'Ana')],
        followUps: { r1: [followUp('f1', 'r1')] as never },
        consents: {
          r1: [
            {
              id: 'c1',
              subjectType: 'RESIDENT',
              subjectId: 'r1',
              purpose: 'IMAGE_PUBLICATION',
              granted: true,
              termVersion: '1.0',
              recordedByUserId: null,
              createdAt: '2026-08-01T10:00:00.000Z',
            },
          ] as never,
        },
        attachments: { r1: [{ id: 'a1', residentId: 'r1' }] as never },
        receivables: { r1: [{ id: 'p2', referenceMonth: '2026-08-01' }] as never },
        ministries: [{ id: 'm1', name: 'Cozinha' }] as never,
      }),
    );

    const result = await syncHouseSnapshot(createClient(), 'h1');

    expect(result).toEqual({ syncedAt: '2026-08-14T12:00:00.000Z', full: true });
    expect((await readResidentList('h1'))?.data.map((r) => r.id)).toEqual(['r1']);
    expect(await readResident('antigo')).toBeNull();
    expect((await readResidentDetail('r1', 'follow_ups'))?.data).toHaveLength(1);
    expect((await readResidentDetail('r1', 'consents'))?.data[0]).toMatchObject({
      purpose: 'IMAGE_PUBLICATION',
      granted: true,
    });
    expect((await readResidentDetail('r1', 'attachments'))?.data).toHaveLength(1);
    expect((await readResidentDetail('r1', 'receivables'))?.data).toHaveLength(1);
    expect((await readHouseMinistries('h1'))?.data).toHaveLength(1);
  });

  it('carnê vazio do SERVO não vira "carnê vazio de verdade"', async () => {
    houseSnapshot.mockResolvedValue(
      snapshot({ full: true, residents: [resident('r1', 'Ana')], receivables: {} }),
    );
    const client = createClient();

    await syncHouseSnapshot(client, 'h1');

    // Nada gravado e nada semeado: a tela do carnê continua pedindo à rede em
    // vez de mostrar uma lista vazia que o servidor nunca mandou.
    expect(await readResidentDetail('r1', 'receivables')).toBeNull();
    expect(client.getQueryData(queryKeys.residents.receivables('r1'))).toBeUndefined();
  });

  it('acompanhamentos ficam na ordem do endpoint (data desc, criação desc)', async () => {
    const mesmoDia = followUp('f3', 'r1', '2026-08-09');
    houseSnapshot.mockResolvedValue(
      snapshot({
        residents: [resident('r1', 'Ana')],
        followUps: {
          r1: [
            followUp('f1', 'r1', '2026-08-01'),
            { ...(mesmoDia as object), id: 'f3', createdAt: '2026-08-09T08:00:00.000Z' },
            { ...(mesmoDia as object), id: 'f2', createdAt: '2026-08-09T20:00:00.000Z' },
          ] as never,
        },
      }),
    );

    await syncHouseSnapshot(createClient(), 'h1');

    const stored = await readResidentDetail('r1', 'follow_ups');
    expect(stored?.data.map((item) => item.id)).toEqual(['f2', 'f3', 'f1']);
  });
});

describe('syncHouseSnapshot — delta', () => {
  it('faz merge sem apagar o que não veio', async () => {
    await saveResidentList('h1', [resident('r1', 'Ana'), resident('r2', 'Bento')]);
    await saveResidentDetail('r1', 'follow_ups', [followUp('f1', 'r1', '2026-08-01')] as never);

    houseSnapshot.mockResolvedValue(
      snapshot({
        full: false,
        residents: [resident('r2', 'Bento da Silva')],
        followUps: { r1: [followUp('f2', 'r1', '2026-08-12')] as never },
        ministries: [{ id: 'm2', name: 'Horta' }] as never,
      }),
    );

    await syncHouseSnapshot(createClient(), 'h1');

    expect((await readHouseMinistries('h1'))?.data).toEqual([{ id: 'm2', name: 'Horta' }]);
    const list = await readResidentList('h1');
    expect(list?.data.map((r) => r.name)).toEqual(['Ana', 'Bento da Silva']);
    expect((await readResidentDetail('r1', 'follow_ups'))?.data.map((f) => f.id)).toEqual([
      'f2',
      'f1',
    ]);
  });

  it('acompanhamento editado substitui a versão guardada (merge por id)', async () => {
    await saveResidentDetail('r1', 'follow_ups', [followUp('f1', 'r1', '2026-08-01')] as never);
    houseSnapshot.mockResolvedValue(
      snapshot({
        full: false,
        followUps: {
          r1: [{ ...(followUp('f1', 'r1', '2026-08-01') as object), description: 'corrigido' }] as never,
        },
      }),
    );

    await syncHouseSnapshot(createClient(), 'h1');

    const stored = await readResidentDetail('r1', 'follow_ups');
    expect(stored?.data).toHaveLength(1);
    expect(stored?.data[0]).toMatchObject({ description: 'corrigido' });
  });

  it('consentimento novo consolida sobre o estado guardado', async () => {
    await saveResidentDetail('r1', 'consents', [
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
    ] as never);

    houseSnapshot.mockResolvedValue(
      snapshot({
        full: false,
        consents: {
          r1: [
            {
              id: 'c2',
              subjectType: 'RESIDENT',
              subjectId: 'r1',
              purpose: 'IMAGE_PUBLICATION',
              granted: false,
              termVersion: '1.0',
              recordedByUserId: null,
              createdAt: '2026-08-12T10:00:00.000Z',
            },
          ] as never,
        },
      }),
    );

    await syncHouseSnapshot(createClient(), 'h1');

    const stored = await readResidentDetail('r1', 'consents');
    expect(stored?.data).toEqual([
      expect.objectContaining({ purpose: 'IMAGE_PUBLICATION', granted: false }),
      expect.objectContaining({ purpose: 'RELIGIOUS_DISCLOSURE', granted: true }),
    ]);
  });

  it('parcela nova entra no carnê guardado, em ordem de competência', async () => {
    await saveResidentDetail('r1', 'receivables', [
      { id: 'p1', referenceMonth: '2026-07-01' },
    ] as never);

    houseSnapshot.mockResolvedValue(
      snapshot({
        full: false,
        receivables: {
          r1: [
            { id: 'p3', referenceMonth: '2026-09-01' },
            { id: 'p2', referenceMonth: '2026-08-01' },
          ] as never,
        },
      }),
    );

    await syncHouseSnapshot(createClient(), 'h1');

    expect((await readResidentDetail('r1', 'receivables'))?.data.map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'p3',
    ]);
  });

  it('filho sem casa no payload entra na casa sincronizada', async () => {
    houseSnapshot.mockResolvedValue(
      snapshot({
        full: false,
        residents: [{ id: 'r1', name: 'Ana', houseId: null, status: 'ACTIVE' } as never],
      }),
    );

    await syncHouseSnapshot(createClient(), 'h1');

    expect((await readResidentList('h1'))?.data.map((r) => r.id)).toEqual(['r1']);
  });

  it('anexo vem completo por filho: substitui o bloco em vez de mesclar', async () => {
    await saveResidentDetail('r1', 'attachments', [{ id: 'a1' }, { id: 'a2' }] as never);
    houseSnapshot.mockResolvedValue(
      snapshot({ full: false, attachments: { r1: [{ id: 'a2' }] as never } }),
    );

    await syncHouseSnapshot(createClient(), 'h1');

    expect((await readResidentDetail('r1', 'attachments'))?.data).toEqual([{ id: 'a2' }]);
  });

  it('`deleted` some do aparelho: filho, acompanhamento e parcela', async () => {
    await saveResidentList('h1', [resident('r1', 'Ana'), resident('r2', 'Bento')]);
    await saveResidentDetail('r2', 'follow_ups', [followUp('f9', 'r2')] as never);
    await saveResidentDetail('r1', 'follow_ups', [
      followUp('f1', 'r1'),
      followUp('f2', 'r1'),
    ] as never);
    await saveResidentDetail('r1', 'receivables', [
      { id: 'p1', referenceMonth: '2026-07-01' },
      { id: 'p2', referenceMonth: '2026-08-01' },
    ] as never);

    houseSnapshot.mockResolvedValue(
      snapshot({
        full: false,
        // r2 deixou de ser presente (alta, evasão, transferência).
        deleted: { residents: ['r2'], followUps: ['f1'], receivables: ['p1'] },
      }),
    );

    await syncHouseSnapshot(createClient(), 'h1');

    expect(await readResident('r2')).toBeNull();
    expect(await readResidentDetail('r2', 'follow_ups')).toBeNull();
    expect((await readResidentDetail('r1', 'follow_ups'))?.data.map((f) => f.id)).toEqual(['f2']);
    expect((await readResidentDetail('r1', 'receivables'))?.data.map((p) => p.id)).toEqual(['p2']);
  });

  it('delta sem ministério não apaga os ministérios guardados', async () => {
    houseSnapshot.mockResolvedValueOnce(
      snapshot({ full: true, ministries: [{ id: 'm1' }] as never }),
    );
    await syncHouseSnapshot(createClient(), 'h1');

    houseSnapshot.mockResolvedValueOnce(snapshot({ full: false, ministries: [] }));
    await syncHouseSnapshot(createClient(), 'h1');

    expect((await readHouseMinistries('h1'))?.data).toEqual([{ id: 'm1' }]);
  });
});

describe('syncHouseSnapshot — cache do React Query', () => {
  it('semeia a tela montada com o que veio', async () => {
    houseSnapshot.mockResolvedValue(
      snapshot({
        residents: [resident('r1', 'Ana')],
        followUps: { r1: [followUp('f1', 'r1')] as never },
        ministries: [{ id: 'm1' }] as never,
      }),
    );
    const client = createClient();

    await syncHouseSnapshot(client, 'h1');

    expect(client.getQueryData(queryKeys.residents.byHouse('h1'))).toHaveLength(1);
    expect(client.getQueryData(queryKeys.residents.detail('r1'))).toMatchObject({ name: 'Ana' });
    expect(client.getQueryData(queryKeys.residents.followUps('r1'))).toHaveLength(1);
    expect(client.getQueryData(queryKeys.houses.ministries('h1'))).toEqual([{ id: 'm1' }]);
  });
});

describe('syncHouseSnapshot — sem rede', () => {
  it('não avança o `since`, não limpa o store e não estoura', async () => {
    await saveResidentList('h1', [resident('r1', 'Ana')]);
    await setLastSyncedAt('h1', '2026-08-13T09:00:00.000Z');
    houseSnapshot.mockRejectedValue(new Error('Network Error'));

    await expect(syncHouseSnapshot(createClient(), 'h1')).resolves.toBeNull();

    expect(await lastSyncedAt('h1')).toBe('2026-08-13T09:00:00.000Z');
    expect((await readResidentList('h1'))?.data).toHaveLength(1);
  });
});
