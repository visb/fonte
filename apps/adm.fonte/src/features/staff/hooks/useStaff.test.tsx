import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    staff: {
      me: vi.fn(),
      updateMe: vi.fn(),
      uploadPhotoMe: vi.fn(),
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getPermissions: vi.fn(),
      addPermission: vi.fn(),
      removePermission: vi.fn(),
      uploadPhoto: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useStaff,
  useStaffById,
  useStaffMe,
  useCreateStaff,
  useUpdateStaff,
  useUpdateStaffMe,
  useResetStaffPassword,
  useDeleteStaff,
  useStaffPermissions,
  useAddStaffPermission,
  useRemoveStaffPermission,
} from './useStaff';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('useStaff', () => {
  it('lista com a queryKey e respeita enabled=false', async () => {
    vi.mocked(api.staff.list).mockResolvedValue([{ id: 's1' }] as never);
    const { result, queryClient } = renderHookWithClient(() => useStaff());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.staff.list).toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.staff.all)).toEqual([{ id: 's1' }]);

    vi.mocked(api.staff.list).mockClear();
    const { result: r2 } = renderHookWithClient(() => useStaff({ enabled: false }));
    expect(r2.current.fetchStatus).toBe('idle');
    expect(api.staff.list).not.toHaveBeenCalled();
  });
});

describe('useStaffById / useStaffMe / useStaffPermissions', () => {
  it('getById desligado com id vazio', () => {
    const { result } = renderHookWithClient(() => useStaffById(''));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('getById busca com id', async () => {
    vi.mocked(api.staff.getById).mockResolvedValue({ id: 's1' } as never);
    const { result } = renderHookWithClient(() => useStaffById('s1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.staff.getById).toHaveBeenCalledWith('s1');
  });

  it('me busca o staff atual', async () => {
    vi.mocked(api.staff.me).mockResolvedValue({ id: 'me' } as never);
    const { result } = renderHookWithClient(() => useStaffMe());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.staff.me).toHaveBeenCalled();
  });

  it('permissions desligado sem staffId, ligado com', async () => {
    const { result } = renderHookWithClient(() => useStaffPermissions(''));
    expect(result.current.fetchStatus).toBe('idle');

    vi.mocked(api.staff.getPermissions).mockResolvedValue([] as never);
    const { result: r2 } = renderHookWithClient(() => useStaffPermissions('s1'));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(api.staff.getPermissions).toHaveBeenCalledWith('s1');
  });
});

describe('mutations de staff', () => {
  it('create invalida a lista', async () => {
    vi.mocked(api.staff.create).mockResolvedValue({ id: 's1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useCreateStaff());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ name: 'X' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.staff.create).toHaveBeenCalledWith({ name: 'X' });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.staff.all });
  });

  it('update sem foto invalida lista e detalhe', async () => {
    vi.mocked(api.staff.update).mockResolvedValue(undefined as never);
    const { result, queryClient } = renderHookWithClient(() => useUpdateStaff('s1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ data: { name: 'Y' } } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.staff.update).toHaveBeenCalledWith('s1', { name: 'Y' });
    expect(api.staff.uploadPhoto).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.staff.detail('s1') });
  });

  it('update com foto também faz upload', async () => {
    vi.mocked(api.staff.update).mockResolvedValue(undefined as never);
    vi.mocked(api.staff.uploadPhoto).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useUpdateStaff('s1'));
    result.current.mutate({ data: { name: 'Y' }, photo: new Blob(['x']) } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.staff.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  it('updateMe com foto faz upload e invalida me', async () => {
    vi.mocked(api.staff.updateMe).mockResolvedValue(undefined as never);
    vi.mocked(api.staff.uploadPhotoMe).mockResolvedValue(undefined as never);
    const { result, queryClient } = renderHookWithClient(() => useUpdateStaffMe());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ data: { name: 'Z' }, photo: new Blob(['x']) } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.staff.uploadPhotoMe).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.staffMe.current });
  });

  it('resetPassword chama update com password', async () => {
    vi.mocked(api.staff.update).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useResetStaffPassword('s1'));
    result.current.mutate('newpass');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.staff.update).toHaveBeenCalledWith('s1', { password: 'newpass' });
  });

  it('delete invalida a lista', async () => {
    vi.mocked(api.staff.delete).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useDeleteStaff());
    result.current.mutate('s1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.staff.delete).toHaveBeenCalledWith('s1');
  });

  it('add/remove permission invalidam permissions', async () => {
    vi.mocked(api.staff.addPermission).mockResolvedValue(undefined as never);
    vi.mocked(api.staff.removePermission).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useAddStaffPermission('s1'));
    result.current.mutate('MANAGE_BILLING' as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.staff.addPermission).toHaveBeenCalledWith('s1', { type: 'MANAGE_BILLING' });

    const { result: r2 } = renderHookWithClient(() => useRemoveStaffPermission('s1'));
    r2.current.mutate('MANAGE_BILLING' as never);
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(api.staff.removePermission).toHaveBeenCalledWith('s1', 'MANAGE_BILLING');
  });
});
