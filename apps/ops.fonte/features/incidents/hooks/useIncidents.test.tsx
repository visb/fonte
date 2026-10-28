import { waitFor } from '@testing-library/react-native';
import { IncidentType } from '@fonte/types';

jest.mock('@/lib/api', () => ({
  api: {
    incidents: {
      list: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { expectIdempotencyKey, renderHookWithClient } from '@/lib/test/utils';
import * as incidentHooks from './useIncidents';
import { useIncidents, useCreateIncident } from './useIncidents';

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
