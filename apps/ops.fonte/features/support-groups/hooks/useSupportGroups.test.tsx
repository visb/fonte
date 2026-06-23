import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: {
    supportGroups: {
      list: jest.fn(),
      listAllMeetings: jest.fn(),
      getMeeting: jest.fn(),
      createMeeting: jest.fn(),
      addCheckin: jest.fn(),
      removeCheckin: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useSupportGroups,
  useAllMeetings,
  useMeetingDetail,
  useCreateMeeting,
  useAddCheckin,
  useRemoveCheckin,
} from './useSupportGroups';

const m = api as unknown as { supportGroups: Record<string, jest.Mock> };

beforeEach(() => jest.clearAllMocks());

describe('useSupportGroups', () => {
  it('lista grupos', async () => {
    m.supportGroups.list.mockResolvedValue([{ id: 'g1' }]);
    const { result } = renderHookWithClient(() => useSupportGroups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.supportGroups.list).toHaveBeenCalled();
  });

  it('useAllMeetings lista todas as reuniões', async () => {
    m.supportGroups.listAllMeetings.mockResolvedValue([{ id: 'mt1' }]);
    const { result } = renderHookWithClient(() => useAllMeetings());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.supportGroups.listAllMeetings).toHaveBeenCalled();
  });

  it('useMeetingDetail busca por id (enabled)', async () => {
    m.supportGroups.getMeeting.mockResolvedValue({ id: 'mt1' });
    const { result } = renderHookWithClient(() => useMeetingDetail('mt1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.supportGroups.getMeeting).toHaveBeenCalledWith('mt1');
  });

  it('useMeetingDetail não dispara sem id', () => {
    renderHookWithClient(() => useMeetingDetail(undefined));
    expect(m.supportGroups.getMeeting).not.toHaveBeenCalled();
  });

  it('useCreateMeeting cria reunião do grupo', async () => {
    m.supportGroups.createMeeting.mockResolvedValue({ id: 'mt1' });
    const { result } = renderHookWithClient(() => useCreateMeeting('g1'));
    result.current.mutate({ date: '2026-06-23' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.supportGroups.createMeeting).toHaveBeenCalledWith('g1', { date: '2026-06-23' });
  });

  it('useAddCheckin registra presença', async () => {
    m.supportGroups.addCheckin.mockResolvedValue({ id: 'ck1' });
    const { result } = renderHookWithClient(() => useAddCheckin('mt1'));
    result.current.mutate({ relativeId: 'rel1' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.supportGroups.addCheckin).toHaveBeenCalledWith('mt1', { relativeId: 'rel1' });
  });

  it('useRemoveCheckin remove a presença', async () => {
    m.supportGroups.removeCheckin.mockResolvedValue(undefined);
    const { result } = renderHookWithClient(() => useRemoveCheckin('mt1'));
    result.current.mutate('ck1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.supportGroups.removeCheckin).toHaveBeenCalledWith('mt1', 'ck1');
  });
});
