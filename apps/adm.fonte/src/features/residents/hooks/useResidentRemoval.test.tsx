import { describe, expect, it, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';

const update = vi.fn();
vi.mock('@/lib/api', () => ({ api: { residents: { update: (...a: unknown[]) => update(...a) } } }));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/lib/toast', () => ({
  toastSuccess: (m: string) => toastSuccess(m),
  toastError: (e: unknown, f: string) => toastError(e, f),
}));

import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/queryKeys';
import { createTestQueryClient, renderHookWithClient } from '@/test/utils';
import { useRemoveResident } from './useResidentRemoval';

beforeEach(() => vi.clearAllMocks());

describe('useRemoveResident', () => {
  it('invalida listagem, detalhe e listagem por casa no sucesso', async () => {
    update.mockResolvedValue({ id: 'r1' });
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHookWithClient(
      () => useRemoveResident({ id: 'r1', houseId: 'h1' }),
      { client },
    );

    result.current.mutate({ status: ResidentStatus.DISCHARGED, exitDate: '2026-06-23' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(update).toHaveBeenCalledWith('r1', {
      status: ResidentStatus.DISCHARGED,
      exitDate: '2026-06-23',
    });
    const keys = invalidate.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey));
    expect(keys).toContain(JSON.stringify(queryKeys.residents.all));
    expect(keys).toContain(JSON.stringify(queryKeys.residents.detail('r1')));
    expect(keys).toContain(JSON.stringify(queryKeys.houses.residents('h1')));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('filho sem casa (ARCHIVED) não invalida listagem por casa', async () => {
    update.mockResolvedValue({ id: 'r1' });
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHookWithClient(() => useRemoveResident({ id: 'r1', houseId: null }), {
      client,
    });

    result.current.mutate({ houseId: 'h2' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  /**
   * O 400 do guard de transição do backend (story 196, decisão 6) precisa chegar
   * ao usuário com a FRASE do backend — não com "Request failed with status
   * code 400" nem com erro cru de axios.
   */
  it('erro do backend vira toast com a frase do backend', async () => {
    const backendError = {
      response: { data: { message: 'Filho já encerrado (evasão) não pode receber alta.' } },
    };
    update.mockRejectedValue(backendError);
    const { result } = renderHookWithClient(() => useRemoveResident({ id: 'r1', houseId: 'h1' }));

    result.current.mutate({ status: ResidentStatus.DISCHARGED, exitDate: '2026-06-23' });
    await waitFor(() => expect(toastError).toHaveBeenCalled());

    const [error, fallback] = toastError.mock.calls[0];
    expect(getErrorMessage(error, fallback)).toBe(
      'Filho já encerrado (evasão) não pode receber alta.',
    );
  });
});
