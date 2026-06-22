import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    residents: { contributionsReport: vi.fn() },
    streetSales: { report: vi.fn() },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import { useContributionsReport } from './useContributions';
import { useStreetSalesReport } from './useStreetSalesReport';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('useContributionsReport', () => {
  it('busca o relatório de filhos com a queryKey de params', async () => {
    vi.mocked(api.residents.contributionsReport).mockResolvedValue({ rows: [] } as never);
    const params = { month: '2026-06', houseId: 'h1' };
    const { result, queryClient } = renderHookWithClient(() => useContributionsReport(params));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.contributionsReport).toHaveBeenCalledWith(params);
    expect(queryClient.getQueryData(queryKeys.billing.filhos.report(params))).toEqual({ rows: [] });
  });
});

describe('useStreetSalesReport', () => {
  it('busca o relatório de vendas de rua com a queryKey de params', async () => {
    vi.mocked(api.streetSales.report).mockResolvedValue({ total: 0 } as never);
    const params = { type: 'BREAD' as never, month: '2026-06' };
    const { result } = renderHookWithClient(() => useStreetSalesReport(params));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.streetSales.report).toHaveBeenCalledWith(params);
  });
});
