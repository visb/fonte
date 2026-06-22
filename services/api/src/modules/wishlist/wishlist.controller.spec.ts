import { WishlistController } from './wishlist.controller';

function svc() {
  return {
    findPending: jest.fn().mockResolvedValue([]),
    findAllForCaller: jest.fn().mockResolvedValue([]),
    addItem: jest.fn().mockResolvedValue({ id: 'i1' }),
    requestRemoval: jest.fn().mockResolvedValue(undefined),
    approve: jest.fn().mockResolvedValue({ id: 'i1' }),
    reject: jest.fn().mockResolvedValue({ id: 'i1' }),
  };
}
const user = { userId: 'u1', role: 'RESIDENT' } as never;

describe('WishlistController', () => {
  it('delegates every endpoint with caller identity', async () => {
    const s = svc();
    const c = new WishlistController(s as never);
    await c.getPending(user);
    await c.getItems(user, 'res-1');
    await c.addItem(user, 'res-1', { name: 'Tênis' } as never);
    await c.removeItem(user, 'res-1', 'i1');
    await c.approve(user, 'i1');
    await c.reject(user, 'i1', { reason: 'no' } as never);
    expect(s.findPending).toHaveBeenCalledWith('u1');
    expect(s.findAllForCaller).toHaveBeenCalledWith('u1', 'RESIDENT', 'res-1');
    expect(s.addItem).toHaveBeenCalledWith('u1', 'res-1', { name: 'Tênis' });
    expect(s.requestRemoval).toHaveBeenCalledWith('u1', 'res-1', 'i1');
    expect(s.approve).toHaveBeenCalledWith('u1', 'i1');
    expect(s.reject).toHaveBeenCalledWith('u1', 'i1', 'no');
  });
});
