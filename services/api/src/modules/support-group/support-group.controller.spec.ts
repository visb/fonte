import { SupportGroupController } from './support-group.controller';

function svc() {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'g1' }),
    findAllMeetings: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'g1' }),
    update: jest.fn().mockResolvedValue({ id: 'g1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    findMeetings: jest.fn().mockResolvedValue([]),
    createMeeting: jest.fn().mockResolvedValue({ id: 'mt1' }),
    findMeetingDetail: jest.fn().mockResolvedValue({ id: 'mt1' }),
    findMeetingRelativeCheckins: jest.fn().mockResolvedValue([]),
    findRelativeCheckinHistory: jest.fn().mockResolvedValue([]),
    findResidentCheckinHistory: jest.fn().mockResolvedValue([]),
    addCheckin: jest.fn().mockResolvedValue({ id: 'ck1' }),
    removeCheckin: jest.fn().mockResolvedValue(undefined),
    addRelativeCheckin: jest.fn().mockResolvedValue({ id: 'ck2' }),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('SupportGroupController', () => {
  it('group + meeting + checkin routes delegate to the service', async () => {
    const s = svc();
    const c = new SupportGroupController(s as never);
    await c.findAll();
    await c.create({ name: 'G' } as never);
    await c.findAllMeetings();
    await c.findOne('g1');
    await c.update('g1', { name: 'X' } as never);
    await c.remove('g1');
    await c.findMeetings('g1');
    await c.createMeeting('g1', { date: 'd' } as never);
    await c.findMeetingDetail('mt1');
    await c.findMeetingRelativeCheckins('mt1');
    await c.findRelativeCheckinHistory('rel1');
    await c.findResidentCheckinHistory('res1');
    await c.addCheckin('mt1', { residentId: 'res1' } as never);
    await c.removeCheckin('mt1', 'ck1');
    await c.addRelativeCheckin({ userId: 'u1' } as never, { token: 'tok' } as never);
    expect(s.createMeeting).toHaveBeenCalledWith('g1', { date: 'd' });
    expect(s.addCheckin).toHaveBeenCalledWith('mt1', 'res1');
    expect(s.addRelativeCheckin).toHaveBeenCalledWith('u1', 'tok');
  });
});
