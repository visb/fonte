import { expect, it, vi } from 'vitest';
import { createHousesModule } from './houses';
import { createResidentsModule } from './residents';

it('fetches grouped house contributions with optional month', async () => {
  const http = { get: vi.fn().mockResolvedValue({ data: [] }) };
  const houses = createHousesModule(http as never);
  expect(await houses.productContributions('h', { referenceMonth: '2026-09-01' })).toEqual([]);
  expect(http.get).toHaveBeenCalledWith('/houses/h/product-contributions', { params: { referenceMonth: '2026-09-01' } });
  await houses.productContributions('h');
  expect(http.get).toHaveBeenLastCalledWith('/houses/h/product-contributions', { params: undefined });
});
it('product declaration forwards stable replay idempotency key', async () => {
  const http = { post: vi.fn().mockResolvedValue({ data: [] }) };
  await createResidentsModule(http as never).declareProductContributions('r', 'rc', { lines: [] }, { idempotencyKey: 'uuid' });
  expect(http.post).toHaveBeenCalledWith('/residents/r/receivables/rc/product-contributions', { lines: [] }, { headers: { 'Idempotency-Key': 'uuid' } });
});
