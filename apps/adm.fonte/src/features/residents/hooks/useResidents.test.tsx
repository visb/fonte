import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    residents: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateIdentity: vi.fn(),
      delete: vi.fn(),
      uploadPhoto: vi.fn(),
      generateAccess: vi.fn(),
      promoteToServant: vi.fn(),
      resetPassword: vi.fn(),
      getDocuments: vi.fn(),
      getAttachments: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      getAdmissions: vi.fn(),
      readmit: vi.fn(),
      uploadSignedDocument: vi.fn(),
    },
    relatives: {
      listByResident: vi.fn(),
      create: vi.fn(),
      setResponsible: vi.fn(),
      delete: vi.fn(),
      generateAccess: vi.fn(),
      resetPassword: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useInfiniteResidents,
  useResidentById,
  useCreateResident,
  useUpdateResident,
  useUpdateResidentIdentity,
  useDeleteResident,
  useGenerateResidentAccess,
  usePromoteResidentToServant,
  useResetResidentPassword,
  useResidentRelatives,
  useAddRelative,
  useSetResponsibleRelative,
  useDeleteRelative,
  useResidentDocuments,
  useResidentAttachments,
  useAddAttachment,
  useDeleteAttachment,
  useGenerateRelativeAccess,
  useResetRelativePassword,
  useResidentAdmissions,
  useReadmitResident,
  useUploadSignedDocument,
} from './useResidents';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('queries de residente', () => {
  it('useInfiniteResidents pagina via total', async () => {
    vi.mocked(api.residents.list).mockResolvedValue({ data: [{ id: 'r1' }], total: 1 } as never);
    const { result } = renderHookWithClient(() =>
      useInfiniteResidents({ search: 's', status: 'ACTIVE' as never, houseId: 'h1' }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, search: 's', houseId: 'h1' }),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it('useInfiniteResidents repassa sort/order ao endpoint', async () => {
    vi.mocked(api.residents.list).mockResolvedValue({ data: [], total: 0 } as never);
    const { result } = renderHookWithClient(() =>
      useInfiniteResidents({ sort: 'entryDate', order: 'desc' }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.list).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'entryDate', order: 'desc' }),
    );
  });

  it('getById desliga sem id', () => {
    const { result } = renderHookWithClient(() => useResidentById(''));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('documents/attachments/admissions respeitam enabled e id', async () => {
    const { result } = renderHookWithClient(() => useResidentDocuments('', { enabled: true }));
    expect(result.current.fetchStatus).toBe('idle');

    vi.mocked(api.residents.getAttachments).mockResolvedValue([] as never);
    const { result: r2 } = renderHookWithClient(() => useResidentAttachments('r1'));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(api.residents.getAttachments).toHaveBeenCalledWith('r1');

    vi.mocked(api.residents.getAdmissions).mockResolvedValue([] as never);
    const { result: r3 } = renderHookWithClient(() => useResidentAdmissions('r1'));
    await waitFor(() => expect(r3.current.isSuccess).toBe(true));
    expect(api.residents.getAdmissions).toHaveBeenCalledWith('r1');
  });

  it('relatives lista por residente', async () => {
    vi.mocked(api.relatives.listByResident).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useResidentRelatives('r1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.relatives.listByResident).toHaveBeenCalledWith('r1');
  });
});

describe('mutations de residente', () => {
  it('create sem foto', async () => {
    vi.mocked(api.residents.create).mockResolvedValue({ id: 'r1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useCreateResident());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ data: { name: 'X' } } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.uploadPhoto).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.all });
  });

  it('create com foto faz upload', async () => {
    vi.mocked(api.residents.create).mockResolvedValue({ id: 'r1' } as never);
    vi.mocked(api.residents.uploadPhoto).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useCreateResident());
    result.current.mutate({ data: { name: 'X' }, photo: new Blob(['x']) } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.uploadPhoto).toHaveBeenCalledWith('r1', expect.any(FormData));
  });

  it('update com foto invalida detalhe', async () => {
    vi.mocked(api.residents.update).mockResolvedValue(undefined as never);
    vi.mocked(api.residents.uploadPhoto).mockResolvedValue(undefined as never);
    const { result, queryClient } = renderHookWithClient(() => useUpdateResident('r1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ data: { name: 'Y' }, photo: new Blob(['x']) } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.uploadPhoto).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.detail('r1') });
  });

  it('updateIdentity muta e invalida detalhe + lista (story 147)', async () => {
    vi.mocked(api.residents.updateIdentity).mockResolvedValue({ id: 'r1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useUpdateResidentIdentity('r1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ name: 'Novo Nome', cpf: '12345678900' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.updateIdentity).toHaveBeenCalledWith('r1', { name: 'Novo Nome', cpf: '12345678900' });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.detail('r1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.all });
  });

  it('delete invalida lista', async () => {
    vi.mocked(api.residents.delete).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useDeleteResident());
    result.current.mutate('r1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.delete).toHaveBeenCalledWith('r1');
  });

  it('generateAccess / promote / resetPassword', async () => {
    vi.mocked(api.residents.generateAccess).mockResolvedValue({} as never);
    vi.mocked(api.residents.promoteToServant).mockResolvedValue({} as never);
    vi.mocked(api.residents.resetPassword).mockResolvedValue({} as never);

    const { result: g } = renderHookWithClient(() => useGenerateResidentAccess('r1'));
    g.current.mutate({ username: 'u' } as never);
    await waitFor(() => expect(g.current.isSuccess).toBe(true));
    expect(api.residents.generateAccess).toHaveBeenCalledWith('r1', { username: 'u' });

    const { result: p } = renderHookWithClient(() => usePromoteResidentToServant('r1'));
    p.current.mutate({ houseId: 'h1' } as never);
    await waitFor(() => expect(p.current.isSuccess).toBe(true));
    expect(api.residents.promoteToServant).toHaveBeenCalledWith('r1', { houseId: 'h1' });

    const { result: rp } = renderHookWithClient(() => useResetResidentPassword('r1'));
    rp.current.mutate('newpass');
    await waitFor(() => expect(rp.current.isSuccess).toBe(true));
    expect(api.residents.resetPassword).toHaveBeenCalledWith('r1', { password: 'newpass' });
  });

  it('readmit com foto', async () => {
    vi.mocked(api.residents.readmit).mockResolvedValue({ id: 'r1' } as never);
    vi.mocked(api.residents.uploadPhoto).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useReadmitResident('r1'));
    result.current.mutate({ data: { entryDate: '2026-01-01' }, photo: new Blob(['x']) } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.uploadPhoto).toHaveBeenCalled();
  });

  it('upload signed document invalida documents', async () => {
    vi.mocked(api.residents.uploadSignedDocument).mockResolvedValue({} as never);
    const { result, queryClient } = renderHookWithClient(() => useUploadSignedDocument('r1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ templateId: 't1', file: new File(['x'], 'd.pdf') });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.uploadSignedDocument).toHaveBeenCalledWith('r1', 't1', expect.any(FormData));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.documents('r1') });
  });

  it('add/delete attachment invalidam attachments', async () => {
    vi.mocked(api.residents.addAttachment).mockResolvedValue({} as never);
    vi.mocked(api.residents.deleteAttachment).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useAddAttachment('r1'));
    result.current.mutate(new File(['x'], 'a.pdf'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.addAttachment).toHaveBeenCalledWith('r1', expect.any(FormData));

    const { result: d } = renderHookWithClient(() => useDeleteAttachment('r1'));
    d.current.mutate('at1');
    await waitFor(() => expect(d.current.isSuccess).toBe(true));
    expect(api.residents.deleteAttachment).toHaveBeenCalledWith('r1', 'at1');
  });
});

describe('mutations de parente (relative)', () => {
  it('addRelative monta o payload com nulls e invalida relatives', async () => {
    vi.mocked(api.relatives.create).mockResolvedValue({} as never);
    const { result, queryClient } = renderHookWithClient(() => useAddRelative('r1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ name: 'Mãe' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.relatives.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Mãe', residentId: 'r1', phone: null, relationship: null }),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.relatives('r1') });
  });

  it('setResponsible / delete / generateAccess / resetPassword', async () => {
    vi.mocked(api.relatives.setResponsible).mockResolvedValue({} as never);
    vi.mocked(api.relatives.delete).mockResolvedValue(undefined as never);
    vi.mocked(api.relatives.generateAccess).mockResolvedValue({} as never);
    vi.mocked(api.relatives.resetPassword).mockResolvedValue({} as never);

    const { result: s } = renderHookWithClient(() => useSetResponsibleRelative('r1'));
    s.current.mutate('rel1');
    await waitFor(() => expect(s.current.isSuccess).toBe(true));
    expect(api.relatives.setResponsible).toHaveBeenCalledWith('rel1');

    const { result: d } = renderHookWithClient(() => useDeleteRelative('r1'));
    d.current.mutate('rel1');
    await waitFor(() => expect(d.current.isSuccess).toBe(true));
    expect(api.relatives.delete).toHaveBeenCalledWith('rel1');

    const { result: g, queryClient } = renderHookWithClient(() => useGenerateRelativeAccess('rel1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    g.current.mutate({ username: 'u' } as never);
    await waitFor(() => expect(g.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.relativesAll });

    const { result: rp } = renderHookWithClient(() => useResetRelativePassword('rel1'));
    rp.current.mutate('newpass');
    await waitFor(() => expect(rp.current.isSuccess).toBe(true));
    expect(api.relatives.resetPassword).toHaveBeenCalledWith('rel1', { password: 'newpass' });
  });
});
