import { StoreroomController } from './storeroom.controller';

function svc() {
  return {
    findItems: jest.fn().mockResolvedValue([]),
    createItem: jest.fn().mockResolvedValue({ id: 'i1' }),
    updateItem: jest.fn().mockResolvedValue({ id: 'i1' }),
    removeItem: jest.fn().mockResolvedValue(undefined),
    findMovements: jest.fn().mockResolvedValue([]),
    createMovement: jest.fn().mockResolvedValue({ id: 'm1' }),
  };
}

describe('StoreroomController', () => {
  it('item and movement endpoints delegate', async () => {
    const s = svc();
    const c = new StoreroomController(s as never);
    await c.findItems('h1');
    await c.createItem({ name: 'Arroz' } as never);
    await c.updateItem('i1', { name: 'X' } as never);
    await c.removeItem('i1');
    await c.findMovements('h1', 'i1');
    await c.createMovement({ itemId: 'i1', quantity: 2 } as never);
    expect(s.findItems).toHaveBeenCalledWith('h1');
    expect(s.createItem).toHaveBeenCalledWith({ name: 'Arroz' });
    expect(s.updateItem).toHaveBeenCalledWith('i1', { name: 'X' });
    expect(s.removeItem).toHaveBeenCalledWith('i1');
    expect(s.findMovements).toHaveBeenCalledWith('h1', 'i1');
    expect(s.createMovement).toHaveBeenCalledWith({ itemId: 'i1', quantity: 2 });
  });
});
