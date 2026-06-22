import { ResidentSessionController } from './resident-session.controller';

function svc() {
  return {
    getTodayByUserId: jest.fn().mockResolvedValue({ secondsUsed: 0 }),
    addSeconds: jest.fn().mockResolvedValue({ secondsUsed: 30 }),
    reset: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('ResidentSessionController', () => {
  it('getToday and heartbeat use the current user id', async () => {
    const s = svc();
    const c = new ResidentSessionController(s as never);
    await c.getToday({ userId: 'u1' } as never);
    await c.heartbeat({ userId: 'u1' } as never, { seconds: 30 } as never);
    expect(s.getTodayByUserId).toHaveBeenCalledWith('u1');
    expect(s.addSeconds).toHaveBeenCalledWith('u1', 30);
  });

  it('reset delegates the residentId', async () => {
    const s = svc();
    const c = new ResidentSessionController(s as never);
    await c.reset('res1');
    expect(s.reset).toHaveBeenCalledWith('res1');
  });
});
