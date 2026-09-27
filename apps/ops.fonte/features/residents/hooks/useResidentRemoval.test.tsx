import { waitFor } from '@testing-library/react-native';
import { ResidentStatus } from '@fonte/types';

jest.mock('@/lib/api', () => ({
  api: {
    residents: { update: jest.fn() },
    houses: { list: jest.fn() },
  },
}));

import { api } from '@/lib/api';
import {
  createTestQueryClient,
  expectIdempotencyKey,
  renderHookWithClient,
} from '@/lib/test/utils';
import { OUTBOX_MUTATION_KEYS, serializeMutationKey } from '@/lib/offline/outbox';
import {
  useDischargeResident,
  useEvadeResident,
  useHouses,
  useTransferResident,
} from './useResidentRemoval';

const m = api as unknown as {
  residents: Record<string, jest.Mock>;
  houses: Record<string, jest.Mock>;
};

beforeEach(() => jest.clearAllMocks());

describe('useHouses', () => {
  it('lista as casas', async () => {
    m.houses.list.mockResolvedValue([{ id: 'h1' }]);
    const { result } = renderHookWithClient(() => useHouses());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.houses.list).toHaveBeenCalled();
  });
});

// Specs vindos de `features/census/hooks/useCensus.test.tsx` (story 196), sem
// mudança de expectativa: as hooks mudaram de pasta, não de comportamento.
describe('baixa de filho', () => {
  it('useDischargeResident atualiza para DISCHARGED + exitDate', async () => {
    m.residents.update.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useDischargeResident('h1'));
    result.current.mutate({ residentId: 'r1', exitDate: '2026-06-23' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.update).toHaveBeenCalledWith(
      'r1',
      { status: ResidentStatus.DISCHARGED, exitDate: '2026-06-23' },
      expectIdempotencyKey,
    );
  });

  it('useEvadeResident atualiza para EVADED + exitDate', async () => {
    m.residents.update.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useEvadeResident('h1'));
    result.current.mutate({ residentId: 'r1', exitDate: '2026-06-23' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.update).toHaveBeenCalledWith(
      'r1',
      { status: ResidentStatus.EVADED, exitDate: '2026-06-23' },
      expectIdempotencyKey,
    );
  });

  it('useTransferResident move para outra casa mantendo ACTIVE', async () => {
    m.residents.update.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useTransferResident('h1'));
    result.current.mutate({ residentId: 'r1', targetHouseId: 'h2' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.update).toHaveBeenCalledWith('r1', { houseId: 'h2' }, expectIdempotencyKey);
  });
});

/**
 * Decisão 7 da story 196: a pasta mudou, a `mutationKey` NÃO. Chave trocada
 * abandonaria na fila offline o lançamento pendente de quem atualizasse o app —
 * o item desidratado procura a chave antiga e nunca mais acha `mutationFn`.
 */
describe('mutationKey preservada na mudança de pasta', () => {
  const expected = serializeMutationKey(OUTBOX_MUTATION_KEYS.residentUpdateStatus);

  it.each([
    ['useDischargeResident', () => useDischargeResident('h1')],
    ['useEvadeResident', () => useEvadeResident('h1')],
    ['useTransferResident', () => useTransferResident('h1')],
  ])('%s usa residents/updateStatus', async (_name, hook) => {
    m.residents.update.mockResolvedValue({});
    const client = createTestQueryClient();
    const { result } = renderHookWithClient(hook as () => { mutate: (i: never) => void }, client);
    result.current.mutate({
      residentId: 'r1',
      exitDate: '2026-06-23',
      targetHouseId: 'h2',
    } as never);
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(1));
    const [mutation] = client.getMutationCache().getAll();
    expect(serializeMutationKey(mutation.options.mutationKey)).toBe(expected);
    expect(expected).toBe('residents/updateStatus');
  });
});
