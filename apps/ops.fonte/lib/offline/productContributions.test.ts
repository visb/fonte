import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query';
import type { HouseProductContributionView } from '@fonte/types';
import { queryKeys } from '@/lib/queryKeys';
import { isPersistableQueryKey, isResidentStoreQueryKey } from './constants';
import { OUTBOX_MUTATION_KEYS } from './outbox';
import { registerMutationDefaults, type ProductContributionDeclareVariables } from './mutationDefaults';
import { applyProductContribution, settleProductContribution, mergePendingContributions } from './productContributions';
jest.mock('@/lib/api', () => ({ api: { residents: { declareProductContributions: jest.fn() } } }));
jest.mock('./attachments', () => ({ persistOutboxFile: jest.fn(), buildFormDataFromOutboxFile: jest.fn(), discardOutboxFile: jest.fn() }));
import { api } from '@/lib/api';

const key = queryKeys.houses.productContributions('h', '2026-09-01');
const variables: ProductContributionDeclareVariables = { houseId: 'h', residentId: 'r', receivableId: 'rc', referenceMonth: '2026-09-01', idempotencyKey: 'uuid', lines: [{ inventoryItemId: 'i', quantity: 2, unit: 'kg' }, { description: 'Cesta' }] };
function client() {
  const c = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  registerMutationDefaults(c, { retry: false });
  return c;
}
const read = (c: QueryClient) => c.getQueryData<HouseProductContributionView[]>(key)!;
beforeEach(() => jest.clearAllMocks());

it('persists names only in resident store, with exact prefix matching', () => {
  expect(isResidentStoreQueryKey(key)).toBe(true);
  expect(isPersistableQueryKey(key)).toBe(false);
  expect(isResidentStoreQueryKey(['resident-product-contributions', 'r', 'rc'])).toBe(false);
  expect(isPersistableQueryKey(['resident-product-contributions', 'r', 'rc'])).toBe(false);
});
it('optimistic lines use cached name, append to same resident and survive server refetch', () => {
  const c = client();
  c.setQueryData(queryKeys.residents.byHouse('h'), [{ id: 'r', name: 'Álvaro' }]);
  applyProductContribution(c, variables);
  applyProductContribution(c, { ...variables, idempotencyKey: 'second' });
  expect(read(c)).toHaveLength(1);
  expect(read(c)[0].residentName).toBe('Álvaro');
  expect(read(c)[0].lines).toHaveLength(4);
  expect(mergePendingContributions([], read(c))[0].lines).toHaveLength(4);
  expect(mergePendingContributions(read(c), read(c))[0].lines).toHaveLength(4);
  settleProductContribution(c, variables);
  expect(read(c)[0].lines.map((line) => line.id)).toEqual(['outbox:second:0', 'outbox:second:1']);
  settleProductContribution(c, { ...variables, idempotencyKey: 'second' });
  expect(read(c)).toEqual([]);
});
it('handles detail cache, missing cache, other residents and confirmed groups', () => {
  const c = client();
  settleProductContribution(c, variables);
  c.setQueryData(queryKeys.residents.detail('r'), { name: 'Zé' });
  applyProductContribution(c, variables);
  expect(read(c)[0].residentName).toBe('Zé');
  applyProductContribution(c, { ...variables, residentId: 'r2', receivableId: 'rc2', idempotencyKey: 'other' });
  expect(read(c).map((g) => g.residentName)).toEqual(['Filho', 'Zé']);
  const confirmed = { ...read(c)[1].lines[0], id: 'confirmed' };
  settleProductContribution(c, variables, [confirmed]);
  expect(read(c)[1].lines).toEqual([confirmed]);
  settleProductContribution(c, variables, [confirmed]);
  expect(read(c)[1].lines).toEqual([confirmed]);
  expect(mergePendingContributions([], [read(c)[1]])).toEqual([]);
  expect(mergePendingContributions([])).toEqual([]);
});
it('defaults replay deserialized variables and invalidate all four resource keys', async () => {
  const c = client();
  const invalidate = jest.spyOn(c, 'invalidateQueries');
  const defaults = c.getMutationDefaults(OUTBOX_MUTATION_KEYS.productContributionDeclare);
  const v = JSON.parse(JSON.stringify(variables));
  const m = c.getMutationCache().build(c, { ...defaults, mutationKey: OUTBOX_MUTATION_KEYS.productContributionDeclare });
  const confirmed = [{ id: 'server', receivableId: 'rc' }];
  (api.residents.declareProductContributions as jest.Mock).mockResolvedValue(confirmed);
  await m.execute(v);
  expect(api.residents.declareProductContributions).toHaveBeenCalledWith('r', 'rc', { lines: variables.lines }, { idempotencyKey: 'uuid' });
  for (const queryKey of [key, queryKeys.residents.productContributions('r', 'rc'), queryKeys.residents.receivables('r'), queryKeys.residents.detail('r')]) {
    expect(invalidate).toHaveBeenCalledWith({ queryKey });
  }
  expect(read(c)[0].lines).toEqual(confirmed);
});
it('rejection after restart removes only its optimistic lines', async () => {
  const c = client();
  applyProductContribution(c, variables);
  const defaults = c.getMutationDefaults(OUTBOX_MUTATION_KEYS.productContributionDeclare);
  c.getMutationCache().build(c, { ...defaults, mutationKey: OUTBOX_MUTATION_KEYS.productContributionDeclare }, {
    context: undefined, data: undefined, error: null, failureCount: 0, failureReason: null,
    isPaused: true, status: 'pending', variables, submittedAt: Date.now(),
  });
  const restarted = client();
  hydrate(restarted, JSON.parse(JSON.stringify(dehydrate(c))));
  expect(read(restarted)[0].lines).toHaveLength(2);
  (api.residents.declareProductContributions as jest.Mock).mockRejectedValue({ response: { status: 400, data: { message: 'Parcela inválida' } } });
  await restarted.resumePausedMutations();
  expect(read(restarted)).toEqual([]);
});
