import { waitFor } from '@testing-library/react-native';
import { IncidentCategory, IncidentType } from '@fonte/types';

jest.mock('@/lib/api', () => ({
  api: {
    incidents: {
      list: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { createTestQueryClient, expectIdempotencyKey, renderHookWithClient } from '@/lib/test/utils';
import { queryKeys } from '@/lib/queryKeys';
import { isOutboxEntityId } from '@/lib/offline/outbox';
import * as incidentHooks from './useIncidents';
import {
  residentIncidentsFromCache,
  useIncidents,
  useCreateIncident,
  useResidentIncidents,
} from './useIncidents';

const m = api as unknown as { incidents: Record<string, jest.Mock> };

beforeEach(() => jest.clearAllMocks());

describe('useIncidents', () => {
  it('useIncidents lista por casa', async () => {
    m.incidents.list.mockResolvedValue([{ id: 'in1' }]);
    const { result } = renderHookWithClient(() => useIncidents('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.incidents.list).toHaveBeenCalledWith({ houseId: 'h1' });
  });

  it('useIncidents não dispara sem casa', () => {
    renderHookWithClient(() => useIncidents(null));
    expect(m.incidents.list).not.toHaveBeenCalled();
  });

  // Story 221: o contador "Ocorrências hoje" saiu do dashboard e levou junto o
  // hook dedicado — a lista da casa (`useIncidents`) é a única leitura.
  it('não expõe mais o hook de ocorrências do dia (story 221)', () => {
    expect('useIncidentsToday' in incidentHooks).toBe(false);
  });

  it('useCreateIncident repassa o payload (incidente é não-deletável: só create)', async () => {
    m.incidents.create.mockResolvedValue({ id: 'in1' });
    const { result } = renderHookWithClient(() => useCreateIncident());
    const input = {
      date: '2026-01-01',
      type: IncidentType.POSITIVE,
      category: IncidentCategory.HELPING_OTHERS,
      description: 'Briga no refeitório',
      houseId: 'h1',
      responsibleId: 'staff-1',
      residentIds: ['r1', 'r2'],
    };
    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.incidents.create).toHaveBeenCalledWith(input, expectIdempotencyKey);
  });

  it('useCreateIncident não manda os nomes do otimista ao backend (story 227)', async () => {
    m.incidents.create.mockResolvedValue({ id: 'in1' });
    const { result } = renderHookWithClient(() => useCreateIncident());
    const payload = {
      date: '2026-01-01',
      type: IncidentType.NEGATIVE,
      category: IncidentCategory.AGGRESSION,
      description: 'Briga',
      houseId: 'h1',
      responsibleId: 'staff-1',
      residentIds: ['r1'],
    };
    result.current.mutate({ ...payload, responsibleName: 'Servo', residentNames: ['João'] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.incidents.create).toHaveBeenCalledWith(payload, expectIdempotencyKey);
  });

  it('não expõe mutation de delete (incidente não pode ser deletado — BUSINESS_RULES)', () => {
    expect(Object.keys(incidentHooks).some((k) => /delete|remove/i.test(k))).toBe(false);
  });
});

describe('useResidentIncidents (story 228)', () => {
  const incident = (id: string, residentIds: string[]) => ({
    id,
    date: '2026-03-01',
    type: IncidentType.NEGATIVE,
    category: IncidentCategory.OTHER,
    description: id,
    houseId: 'h1',
    responsible: { id: 's1', name: 'Servo' },
    residents: residentIds.map((rid) => ({ id: rid, name: rid })),
  });

  it('busca por filho (qualquer casa) na chave byResident', async () => {
    m.incidents.list.mockResolvedValue([incident('in1', ['r1'])]);
    const client = createTestQueryClient();
    const { result } = renderHookWithClient(() => useResidentIncidents('r1'), client);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.incidents.list).toHaveBeenCalledWith({ residentId: 'r1' });
    expect(result.current.data?.map((i) => i.id)).toEqual(['in1']);
    expect(client.getQueryData(queryKeys.incidents.byResident('r1'))).toBeDefined();
  });

  it('não dispara sem filho', () => {
    renderHookWithClient(() => useResidentIncidents(undefined));
    expect(m.incidents.list).not.toHaveBeenCalled();
  });

  it('placeholder filtra o cache da casa pelo filho (primeira abertura offline)', () => {
    m.incidents.list.mockReturnValue(new Promise(() => {}));
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.incidents.byHouse('h1'), [
      incident('a', ['r1']),
      incident('b', ['r2']),
      incident('c', ['r2', 'r1']),
    ]);
    const { result } = renderHookWithClient(() => useResidentIncidents('r1'), client);
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('residentIncidentsFromCache: sem lista no cache = undefined; deduplica entre listas', () => {
    const client = createTestQueryClient();
    expect(residentIncidentsFromCache(client, 'r1')).toBeUndefined();
    client.setQueryData(queryKeys.incidents.byHouse('h1'), [incident('a', ['r1'])]);
    client.setQueryData(queryKeys.incidents.byHouse('h2'), [
      incident('a', ['r1']),
      { ...incident('legacy', []), residents: undefined },
    ]);
    expect(residentIncidentsFromCache(client, 'r1')?.map((i) => i.id)).toEqual(['a']);
    expect(residentIncidentsFromCache(client, 'r9')).toEqual([]);
  });

  it('ocorrência otimista da fila aparece só na ficha dos filhos envolvidos', async () => {
    m.incidents.list.mockResolvedValue([]);
    m.incidents.create.mockReturnValue(new Promise(() => {}));
    const client = createTestQueryClient();
    const mine = renderHookWithClient(() => useResidentIncidents('r1'), client);
    const other = renderHookWithClient(() => useResidentIncidents('r2'), client);
    await waitFor(() => expect(mine.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(other.result.current.isSuccess).toBe(true));

    const create = renderHookWithClient(() => useCreateIncident(), client);
    create.result.current.mutate({
      date: '2026-03-02',
      type: IncidentType.POSITIVE,
      category: IncidentCategory.HELPING_OTHERS,
      description: 'Ajudou na cozinha',
      houseId: 'h1',
      responsibleId: 's1',
      residentIds: ['r1'],
      residentNames: ['João'],
      responsibleName: 'Servo',
    });

    await waitFor(() => expect(mine.result.current.data).toHaveLength(1));
    const pending = mine.result.current.data![0];
    expect(pending.description).toBe('Ajudou na cozinha');
    expect(isOutboxEntityId(pending.id)).toBe(true);
    expect(other.result.current.data).toEqual([]);
  });
});
