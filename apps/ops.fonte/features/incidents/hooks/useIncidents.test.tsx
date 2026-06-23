import { waitFor } from '@testing-library/react-native';
import { IncidentSeverity } from '@fonte/types';

jest.mock('@/lib/api', () => ({
  api: {
    incidents: {
      list: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import * as incidentHooks from './useIncidents';
import {
  useIncidents,
  useIncidentsToday,
  useCreateIncident,
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

  it('useIncidentsToday lista por casa', async () => {
    m.incidents.list.mockResolvedValue([{ id: 'in1' }]);
    const { result } = renderHookWithClient(() => useIncidentsToday('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.incidents.list).toHaveBeenCalledWith({ houseId: 'h1' });
  });

  it('useCreateIncident repassa o payload (incidente é não-deletável: só create)', async () => {
    m.incidents.create.mockResolvedValue({ id: 'in1' });
    const { result } = renderHookWithClient(() => useCreateIncident());
    const input = {
      date: '2026-01-01',
      severity: IncidentSeverity.HIGH,
      description: 'Briga no refeitório',
      houseId: 'h1',
      responsibleId: 'staff-1',
      residentId: 'r1',
    };
    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.incidents.create).toHaveBeenCalledWith(input);
  });

  it('não expõe mutation de delete (incidente não pode ser deletado — BUSINESS_RULES)', () => {
    expect(Object.keys(incidentHooks).some((k) => /delete|remove/i.test(k))).toBe(false);
  });
});
