import { ConsentController } from './consent.controller';

function svc() {
  return {
    resolveSubjectForUser: jest.fn().mockResolvedValue({ subjectType: 'RELATIVE', subjectId: 'sub-1' }),
    statusForSubject: jest.fn().mockResolvedValue([]),
    grant: jest.fn().mockResolvedValue({ id: 'c1' }),
    revoke: jest.fn().mockResolvedValue({ id: 'c1' }),
    hasActiveConsent: jest.fn().mockResolvedValue(true),
    history: jest.fn().mockResolvedValue([]),
  };
}
const user = { userId: 'u1', profileType: 'RELATIVE' } as never;

describe('ConsentController', () => {
  it('myStatus resolves the subject then reads its status', async () => {
    const s = svc();
    await new ConsentController(s as never).myStatus(user);
    expect(s.resolveSubjectForUser).toHaveBeenCalledWith('u1', 'RELATIVE');
    expect(s.statusForSubject).toHaveBeenCalledWith('RELATIVE', 'sub-1');
  });

  it('myGrant / myRevoke act on the resolved subject', async () => {
    const s = svc();
    const c = new ConsentController(s as never);
    await c.myGrant({ purpose: 'IMAGE', termVersion: 'v1' } as never, user);
    await c.myRevoke({ purpose: 'IMAGE' } as never, user);
    expect(s.grant).toHaveBeenCalledWith('RELATIVE', 'sub-1', 'IMAGE', 'v1', 'u1');
    expect(s.revoke).toHaveBeenCalledWith('RELATIVE', 'sub-1', 'IMAGE', 'u1');
  });

  it('staff grant / revoke use the dto subject', async () => {
    const s = svc();
    const c = new ConsentController(s as never);
    await c.grant({ subjectType: 'RESIDENT', subjectId: 'r1', purpose: 'IMAGE' } as never, user);
    await c.revoke({ subjectType: 'RESIDENT', subjectId: 'r1', purpose: 'IMAGE' } as never, user);
    expect(s.grant).toHaveBeenCalledWith('RESIDENT', 'r1', 'IMAGE', null, 'u1');
    expect(s.revoke).toHaveBeenCalledWith('RESIDENT', 'r1', 'IMAGE', 'u1');
  });

  it('check returns the active gate result', async () => {
    const s = svc();
    const out = await new ConsentController(s as never).check('RESIDENT' as never, 'r1', 'IMAGE' as never);
    expect(out).toEqual({ active: true });
  });

  it('status and history delegate', async () => {
    const s = svc();
    const c = new ConsentController(s as never);
    await c.status('RESIDENT' as never, 'r1');
    await c.history('RESIDENT' as never, 'r1');
    expect(s.statusForSubject).toHaveBeenCalledWith('RESIDENT', 'r1');
    expect(s.history).toHaveBeenCalledWith('RESIDENT', 'r1');
  });
});
