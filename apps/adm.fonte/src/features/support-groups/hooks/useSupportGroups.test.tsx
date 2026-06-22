import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    supportGroups: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      listMeetings: vi.fn(),
      getMeeting: vi.fn(),
      getMeetingRelativeCheckins: vi.fn(),
      getRelativeCheckinHistory: vi.fn(),
      getResidentCheckinHistory: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useSupportGroups,
  useCreateSupportGroup,
  useUpdateSupportGroup,
  useDeleteSupportGroup,
  useSupportGroupMeetings,
  useSupportGroupMeetingDetail,
  useMeetingRelativeCheckins,
  useRelativeCheckinHistory,
  useResidentCheckinHistory,
} from './useSupportGroups';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('grupos de apoio — queries', () => {
  it('list usa supportGroups.all', async () => {
    vi.mocked(api.supportGroups.list).mockResolvedValue([] as never);
    const { result, queryClient } = renderHookWithClient(() => useSupportGroups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(queryKeys.supportGroups.all)).toEqual([]);
  });

  it('meetings/detail/checkins desligam sem id', () => {
    expect(renderHookWithClient(() => useSupportGroupMeetings(null)).result.current.fetchStatus).toBe('idle');
    expect(renderHookWithClient(() => useSupportGroupMeetingDetail(null)).result.current.fetchStatus).toBe('idle');
    expect(renderHookWithClient(() => useMeetingRelativeCheckins(null)).result.current.fetchStatus).toBe('idle');
  });

  it('meetings busca com groupId', async () => {
    vi.mocked(api.supportGroups.listMeetings).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useSupportGroupMeetings('g1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.supportGroups.listMeetings).toHaveBeenCalledWith('g1');
  });

  it('históricos de checkin respeitam enabled + id', async () => {
    const r = renderHookWithClient(() => useRelativeCheckinHistory('rel1', { enabled: false }));
    expect(r.result.current.fetchStatus).toBe('idle');

    vi.mocked(api.supportGroups.getResidentCheckinHistory).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useResidentCheckinHistory('res1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.supportGroups.getResidentCheckinHistory).toHaveBeenCalledWith('res1');
  });
});

describe('grupos de apoio — mutations', () => {
  it('create / update / delete invalidam a lista', async () => {
    vi.mocked(api.supportGroups.create).mockResolvedValue({ id: 'g1' } as never);
    vi.mocked(api.supportGroups.update).mockResolvedValue({ id: 'g1' } as never);
    vi.mocked(api.supportGroups.delete).mockResolvedValue(undefined as never);

    const { result: c, queryClient } = renderHookWithClient(() => useCreateSupportGroup());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    c.current.mutate({ name: 'Grupo' } as never);
    await waitFor(() => expect(c.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.supportGroups.all });

    const { result: u } = renderHookWithClient(() => useUpdateSupportGroup());
    u.current.mutate({ id: 'g1', data: { name: 'Edit' } } as never);
    await waitFor(() => expect(u.current.isSuccess).toBe(true));
    expect(api.supportGroups.update).toHaveBeenCalledWith('g1', { name: 'Edit' });

    const { result: d } = renderHookWithClient(() => useDeleteSupportGroup());
    d.current.mutate('g1');
    await waitFor(() => expect(d.current.isSuccess).toBe(true));
    expect(api.supportGroups.delete).toHaveBeenCalledWith('g1');
  });
});
