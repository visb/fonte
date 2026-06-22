import { ActivityCommentController } from './activity-comment.controller';

function svc() {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'c1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}
const user = { userId: 'u1', role: 'ADMIN' };

beforeEach(() => jest.clearAllMocks());

describe('ActivityCommentController', () => {
  it('routes scope by activityId and pass the current user', async () => {
    const s = svc();
    const c = new ActivityCommentController(s as never);
    await c.findAll('a1', user as never);
    await c.create('a1', { body: 'hi' } as never, user as never);
    await c.remove('a1', 'c1', user as never);
    expect(s.findAll).toHaveBeenCalledWith('a1', user);
    expect(s.create).toHaveBeenCalledWith('a1', { body: 'hi' }, user);
    expect(s.remove).toHaveBeenCalledWith('a1', 'c1', user);
  });
});
