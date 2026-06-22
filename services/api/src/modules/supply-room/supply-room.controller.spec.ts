import { SupplyRoomController } from './supply-room.controller';

function svc() {
  return {
    findItems: jest.fn().mockResolvedValue([]),
    createItem: jest.fn().mockResolvedValue({ id: 'i1' }),
    updateItem: jest.fn().mockResolvedValue({ id: 'i1' }),
    removeItem: jest.fn().mockResolvedValue(undefined),
    findMovements: jest.fn().mockResolvedValue([]),
    createMovement: jest.fn().mockResolvedValue({ id: 'mv1' }),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('SupplyRoomController', () => {
  it('item + movement routes delegate to the service', async () => {
    const s = svc();
    const c = new SupplyRoomController(s as never);
    await c.findItems('h1');
    await c.createItem({ name: 'Arroz' } as never);
    await c.updateItem('i1', { name: 'Feijao' } as never);
    await c.removeItem('i1');
    await c.findMovements('h1', 'i1');
    await c.createMovement({ itemId: 'i1', quantity: 5 } as never);
    expect(s.findItems).toHaveBeenCalledWith('h1');
    expect(s.findMovements).toHaveBeenCalledWith('h1', 'i1');
    expect(s.createMovement).toHaveBeenCalledWith({ itemId: 'i1', quantity: 5 });
  });
});
