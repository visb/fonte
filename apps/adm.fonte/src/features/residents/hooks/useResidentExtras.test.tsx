import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    residents: {
      getFollowUps: vi.fn(),
      createFollowUp: vi.fn(),
      getReceivables: vi.fn(),
      registerReceivablePayment: vi.fn(),
      reopenReceivable: vi.fn(),
      updateContributionPlan: vi.fn(),
      setContributionExempt: vi.fn(),
      anonymize: vi.fn(),
    },
    consents: { status: vi.fn(), grant: vi.fn(), revoke: vi.fn() },
    audit: { byTarget: vi.fn() },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useResidentFollowUps,
  useCreateFollowUp,
} from './useResidentFollowUps';
import {
  useResidentReceivables,
  useRegisterReceivablePayment,
  useReopenReceivable,
  useUpdateContributionPlan,
  useSetContributionExempt,
} from './useResidentReceivables';
import {
  useResidentConsents,
  useGrantConsent,
  useRevokeConsent,
  useResidentAudit,
  useAnonymizeResident,
} from './usePrivacy';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('follow-ups', () => {
  it('lista respeitando id e cria invalidando follow-ups + detalhe', async () => {
    const { result } = renderHookWithClient(() => useResidentFollowUps(''));
    expect(result.current.fetchStatus).toBe('idle');

    vi.mocked(api.residents.getFollowUps).mockResolvedValue([] as never);
    const { result: r2 } = renderHookWithClient(() => useResidentFollowUps('r1'));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(api.residents.getFollowUps).toHaveBeenCalledWith('r1');

    vi.mocked(api.residents.createFollowUp).mockResolvedValue({} as never);
    const { result: c, queryClient } = renderHookWithClient(() => useCreateFollowUp('r1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    c.current.mutate({ note: 'oi' } as never);
    await waitFor(() => expect(c.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.followUps('r1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.detail('r1') });
  });
});

describe('receivables', () => {
  it('lista respeita enabled', () => {
    const { result } = renderHookWithClient(() =>
      useResidentReceivables('r1', { enabled: false }),
    );
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('registerPayment monta o FormData com campos opcionais e arquivo', async () => {
    vi.mocked(api.residents.registerReceivablePayment).mockResolvedValue({} as never);
    const { result } = renderHookWithClient(() => useRegisterReceivablePayment('r1'));
    result.current.mutate({
      receivableId: 'rec1',
      paidAt: '2026-06-10',
      paymentMethod: 'PIX',
      paidAmount: 100,
      paidFamilyInvestment: 'SOCIAL',
      notes: 'ok',
      file: new File(['x'], 'comp.pdf'),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const fd = vi.mocked(api.residents.registerReceivablePayment).mock.calls[0][2] as FormData;
    expect(fd.get('paidAt')).toBe('2026-06-10');
    expect(fd.get('paymentMethod')).toBe('PIX');
    expect(fd.get('paidAmount')).toBe('100');
    expect(fd.get('paidFamilyInvestment')).toBe('SOCIAL');
    expect(fd.get('notes')).toBe('ok');
    expect(fd.get('file')).toBeInstanceOf(File);
  });

  it('registerPayment sem opcionais omite os campos', async () => {
    vi.mocked(api.residents.registerReceivablePayment).mockResolvedValue({} as never);
    const { result } = renderHookWithClient(() => useRegisterReceivablePayment('r1'));
    result.current.mutate({ receivableId: 'rec1', paidAt: '2026-06-10', paymentMethod: 'PIX' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const fd = vi.mocked(api.residents.registerReceivablePayment).mock.calls[0][2] as FormData;
    expect(fd.get('paidAmount')).toBeNull();
    expect(fd.get('file')).toBeNull();
  });

  it('reopen / updatePlan / setExempt invalidam (billing incluído)', async () => {
    vi.mocked(api.residents.reopenReceivable).mockResolvedValue({} as never);
    vi.mocked(api.residents.updateContributionPlan).mockResolvedValue({} as never);
    vi.mocked(api.residents.setContributionExempt).mockResolvedValue({} as never);

    const { result: r, queryClient } = renderHookWithClient(() => useReopenReceivable('r1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    r.current.mutate('rec1');
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(api.residents.reopenReceivable).toHaveBeenCalledWith('r1', 'rec1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.billing.filhos.all });

    const { result: u } = renderHookWithClient(() => useUpdateContributionPlan('r1'));
    u.current.mutate({ familyInvestment: 'SOCIAL' } as never);
    await waitFor(() => expect(u.current.isSuccess).toBe(true));
    expect(api.residents.updateContributionPlan).toHaveBeenCalledWith('r1', { familyInvestment: 'SOCIAL' });

    const { result: e } = renderHookWithClient(() => useSetContributionExempt('r1'));
    e.current.mutate(true);
    await waitFor(() => expect(e.current.isSuccess).toBe(true));
    expect(api.residents.setContributionExempt).toHaveBeenCalledWith('r1', true);
  });
});

describe('privacy / LGPD', () => {
  it('consents busca status, grant e revoke invalidam consents + audit', async () => {
    vi.mocked(api.consents.status).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useResidentConsents('r1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.consents.status).toHaveBeenCalledWith('RESIDENT', 'r1');

    vi.mocked(api.consents.grant).mockResolvedValue({} as never);
    const { result: g, queryClient } = renderHookWithClient(() => useGrantConsent('r1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    g.current.mutate('IMAGE' as never);
    await waitFor(() => expect(g.current.isSuccess).toBe(true));
    expect(api.consents.grant).toHaveBeenCalledWith(
      expect.objectContaining({ subjectType: 'RESIDENT', subjectId: 'r1', purpose: 'IMAGE' }),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.audit('r1') });

    vi.mocked(api.consents.revoke).mockResolvedValue({} as never);
    const { result: rv } = renderHookWithClient(() => useRevokeConsent('r1'));
    rv.current.mutate('IMAGE' as never);
    await waitFor(() => expect(rv.current.isSuccess).toBe(true));
    expect(api.consents.revoke).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'r1', purpose: 'IMAGE' }),
    );
  });

  it('audit respeita enabled e busca por target', async () => {
    const { result } = renderHookWithClient(() => useResidentAudit('r1', false));
    expect(result.current.fetchStatus).toBe('idle');

    vi.mocked(api.audit.byTarget).mockResolvedValue([] as never);
    const { result: a } = renderHookWithClient(() => useResidentAudit('r1'));
    await waitFor(() => expect(a.current.isSuccess).toBe(true));
    expect(api.audit.byTarget).toHaveBeenCalledWith('resident', 'r1');
  });

  it('anonymize invalida detalhe e lista', async () => {
    vi.mocked(api.residents.anonymize).mockResolvedValue({} as never);
    const { result, queryClient } = renderHookWithClient(() => useAnonymizeResident('r1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.anonymize).toHaveBeenCalledWith('r1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.all });
  });
});
