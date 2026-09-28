import { QueryClient, MutationCache, dehydrate, hydrate, onlineManager } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import { SupplyRoomCategory } from '@fonte/types';
import { queryKeys } from '@/lib/queryKeys';
import { registerMutationDefaults, type ProductContributionDeclareVariables } from './mutationDefaults';
import { OUTBOX_MUTATION_KEYS, recordOutboxFailure } from './outbox';
import { clearDeadLetter, listDeadLetter } from './deadLetter';
import { clearLocalIds, UnresolvedLocalIdError } from './localIds';
import { resolveContributionLines, snapshotCatalogNames, updateCatalogItem } from './catalogItems';
jest.mock('@/lib/api', () => ({ api: {
  storeroom: { createItem: jest.fn() }, supplyRoom: { createItem: jest.fn() }, residents: { declareProductContributions: jest.fn() },
} }));
jest.mock('./attachments', () => ({ persistOutboxFile: jest.fn(), buildFormDataFromOutboxFile: jest.fn(), discardOutboxFile: jest.fn() }));
import { api } from '@/lib/api';
function client() {
  const c = new QueryClient({
    mutationCache: new MutationCache({ onError: (error, _variables, _context, mutation) => recordOutboxFailure(error, mutation) }),
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  registerMutationDefaults(c, { retryDelay: 0 });
  return c;
}
const variables = (): ProductContributionDeclareVariables => ({ houseId: 'house', residentId: 'r', receivableId: 'rc', referenceMonth: '2026-09-01', lines: [{ inventoryItemId: 'local:item', quantity: 2 }, { description: 'Cesta' }] });
const key = queryKeys.inventory.catalog('house');
beforeEach(async () => { jest.clearAllMocks(); await clearLocalIds(); await clearDeadLetter(); onlineManager.setOnline(true); });
afterEach(() => onlineManager.setOnline(true));

it.each([['storeroom', false], ['supply', false], ['storeroom', true], ['supply', true]] as const)('%s rehydrates creation before declaration, legacy scopes=%s', async (source, legacy) => {
  const c = client();
  onlineManager.setOnline(false);
  (api.storeroom.createItem as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
  (api.supplyRoom.createItem as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
  const creationKey = source === 'storeroom' ? OUTBOX_MUTATION_KEYS.storeroomCreateItem : OUTBOX_MUTATION_KEYS.supplyRoomCreateItem;
  const create = c.getMutationCache().build(c, { ...c.getMutationDefaults(creationKey), mutationKey: creationKey });
  const declaration = c.getMutationCache().build(c, { ...c.getMutationDefaults(OUTBOX_MUTATION_KEYS.productContributionDeclare), mutationKey: OUTBOX_MUTATION_KEYS.productContributionDeclare });
  void create.execute({ data: { houseId: 'house', name: 'Arroz', unit: 'kg', ...(source === 'supply' ? { category: SupplyRoomCategory.CLEANING } : {}) }, localId: 'local:item' }).catch(() => undefined);
  await waitFor(() => expect(create.state.isPaused).toBe(true));
  expect(c.getQueryData(key)).toEqual([{ id: 'local:item', name: 'Arroz', unit: 'kg', source }]);
  expect(c.getQueryData(queryKeys.inventory.catalog('other-house'))).toBeUndefined();
  const v = variables();
  void declaration.execute(v).catch(() => undefined);
  await waitFor(() => expect(declaration.state.isPaused).toBe(true));
  expect(v.itemNames).toEqual({ 'local:item': 'Arroz' });
  const resumed = client();
  const dehydrated = JSON.parse(JSON.stringify(dehydrate(c)));
  if (legacy) {
    dehydrated.mutations[0].scope = { id: source };
    dehydrated.mutations[1].scope = { id: 'productContributions' };
  }
  hydrate(resumed, dehydrated);
  c.clear();
  expect(resumed.getMutationCache().getAll()).toHaveLength(2);
  const createApi = source === 'storeroom' ? api.storeroom.createItem : api.supplyRoom.createItem;
  (createApi as jest.Mock).mockClear();
  (createApi as jest.Mock).mockResolvedValue({ id: 'real', name: 'Arroz', unit: 'kg' });
  (api.residents.declareProductContributions as jest.Mock).mockResolvedValue([]);
  onlineManager.setOnline(true);
  await resumed.resumePausedMutations();
  expect(createApi).toHaveBeenCalledTimes(1);
  expect(api.residents.declareProductContributions).toHaveBeenCalledWith('r', 'rc', {
    lines: [{ inventoryItemId: 'real', quantity: 2 }, { description: 'Cesta' }],
  }, { idempotencyKey: expect.any(String) });
  expect(resumed.getQueryData(key)).toEqual([{ id: 'real', name: 'Arroz', unit: 'kg', source }]);
  expect(JSON.stringify((api.residents.declareProductContributions as jest.Mock).mock.calls)).not.toContain('local:');
  const saved = resumed.getMutationCache().getAll()[1].state.variables;
  await resumed.getMutationCache().build(resumed, { ...resumed.getMutationDefaults(OUTBOX_MUTATION_KEYS.productContributionDeclare), mutationKey: OUTBOX_MUTATION_KEYS.productContributionDeclare }).execute(saved);
  expect((api.residents.declareProductContributions as jest.Mock).mock.calls[1][3]).toEqual((api.residents.declareProductContributions as jest.Mock).mock.calls[0][3]);
});

it('rejection rolls back only the product house and names the blocked dependency without calling API', async () => {
  const c = client();
  c.setQueryData(queryKeys.inventory.catalog('other-house'), [{ id: 'other', name: 'Outro' }]);
  const createKey = OUTBOX_MUTATION_KEYS.storeroomCreateItem;
  const creation = { data: { houseId: 'house', name: 'Arroz recusado', unit: 'kg' }, localId: 'local:item' };
  updateCatalogItem(c, creation, 'storeroom', { ...creation.data, id: creation.localId });
  const v = variables();
  snapshotCatalogNames(c, v);
  (api.storeroom.createItem as jest.Mock).mockRejectedValue({ response: { status: 409 } });
  await expect(c.getMutationCache().build(c, { ...c.getMutationDefaults(createKey), mutationKey: createKey }).execute(creation)).rejects.toEqual({ response: { status: 409 } });
  expect(c.getQueryData(key)).toEqual([]);
  expect(c.getQueryData(queryKeys.inventory.catalog('other-house'))).toEqual([{ id: 'other', name: 'Outro' }]);
  await expect(resolveContributionLines(JSON.parse(JSON.stringify(v)))).rejects.toThrow('Arroz recusado');
  await expect(resolveContributionLines(variables())).rejects.toBeInstanceOf(UnresolvedLocalIdError);
  expect(api.residents.declareProductContributions).not.toHaveBeenCalled();
  c.clear();
  await clearLocalIds();
  expect(c.getQueryData(key)).toBeUndefined();
});

it('legacy cross-scope dependency pauses offline, waits online, then fails terminally when creation rejects', async () => {
  const c = client();
  let rejectCreation!: (error: unknown) => void;
  (api.storeroom.createItem as jest.Mock).mockImplementation(() => new Promise((_resolve, reject) => { rejectCreation = reject; }));
  const createKey = OUTBOX_MUTATION_KEYS.storeroomCreateItem;
  const creation = c.getMutationCache().build(c, { ...c.getMutationDefaults(createKey), mutationKey: createKey, scope: { id: 'storeroom' } });
  const creationPromise = creation.execute({ data: { houseId: 'house', name: 'Sabão recusado', unit: 'un' }, localId: 'local:item' }).catch(() => undefined);
  await waitFor(() => expect(rejectCreation).toBeDefined());
  const v = variables();
  snapshotCatalogNames(c, v);
  onlineManager.setOnline(false);
  await expect(resolveContributionLines(v, c)).rejects.toThrow('Network request failed');
  onlineManager.setOnline(true);
  const key = OUTBOX_MUTATION_KEYS.productContributionDeclare;
  const declaration = c.getMutationCache().build(c, { ...c.getMutationDefaults(key), mutationKey: key, scope: { id: 'productContributions' } });
  const result = declaration.execute(v).catch((error) => error);
  rejectCreation({ response: { status: 409 } });
  await creationPromise;
  expect(await result).toBeInstanceOf(UnresolvedLocalIdError);
  expect(declaration.state.error.message).toContain('Sabão recusado');
  expect(declaration.state.status).toBe('error');
  expect((await listDeadLetter()).find((entry) => entry.mutationKey === 'productContributions/declare')?.error)
    .toBe('O produto «Sabão recusado» ainda não foi enviado. Reenvie o cadastro do produto primeiro.');
  expect(api.residents.declareProductContributions).not.toHaveBeenCalled();
});
