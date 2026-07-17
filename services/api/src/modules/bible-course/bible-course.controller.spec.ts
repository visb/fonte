import { BibleCourseController } from './bible-course.controller';

function svc() {
  return {
    findAllModules: jest.fn().mockResolvedValue([]),
    createModule: jest.fn().mockResolvedValue({ id: 'mod1' }),
    updateModule: jest.fn().mockResolvedValue({ id: 'mod1' }),
    removeModule: jest.fn().mockResolvedValue(undefined),
    findAllClasses: jest.fn().mockResolvedValue([]),
    createClass: jest.fn().mockResolvedValue({ id: 'cl1' }),
    findOneClass: jest.fn().mockResolvedValue({ id: 'cl1' }),
    updateClass: jest.fn().mockResolvedValue({ id: 'cl1' }),
    removeClass: jest.fn().mockResolvedValue(undefined),
    findEligibleResidents: jest.fn().mockResolvedValue([]),
    enroll: jest.fn().mockResolvedValue({ id: 'en1' }),
    enrollBulk: jest.fn().mockResolvedValue({ enrolled: 2 }),
    updateEnrollment: jest.fn().mockResolvedValue({ id: 'en1' }),
    removeEnrollment: jest.fn().mockResolvedValue(undefined),
    getClassGrades: jest.fn().mockResolvedValue([]),
    upsertGrade: jest.fn().mockResolvedValue({ id: 'gr1' }),
    markExternalCompletion: jest.fn().mockResolvedValue({ residentId: 'res1' }),
    unmarkExternalCompletion: jest.fn().mockResolvedValue(undefined),
    findExternalCompletion: jest.fn().mockResolvedValue(null),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('BibleCourseController', () => {
  it('module/class/enrollment/grade routes delegate to the service', async () => {
    const s = svc();
    const c = new BibleCourseController(s as never);
    await c.findAllModules();
    await c.createModule({ name: 'M' } as never);
    await c.updateModule('mod1', { name: 'X' } as never);
    await c.removeModule('mod1');
    await c.findAllClasses('OPEN');
    await c.createClass({ name: 'C' } as never);
    await c.findOneClass('cl1');
    await c.updateClass('cl1', { name: 'Y' } as never);
    await c.removeClass('cl1');
    await c.findEligibleResidents(3);
    await c.enroll('cl1', { residentId: 'res1' } as never);
    await c.enrollBulk('cl1', { residentIds: ['res1', 'res2'] } as never);
    await c.updateEnrollment('en1', { status: 'DONE' } as never);
    await c.removeEnrollment('en1');
    await c.getClassGrades('cl1');
    await c.upsertGrade('en1', 'mod1', { grade: 9 } as never);
    expect(s.findAllClasses).toHaveBeenCalledWith('OPEN');
    expect(s.findEligibleResidents).toHaveBeenCalledWith(3);
    expect(s.enroll).toHaveBeenCalledWith('cl1', { residentId: 'res1' });
    expect(s.enrollBulk).toHaveBeenCalledWith('cl1', ['res1', 'res2']);
    expect(s.upsertGrade).toHaveBeenCalledWith('en1', 'mod1', { grade: 9 });
  });
});

// Story 127: o controller só roteia — quem marcou sai do JWT, não do body, para
// o cliente não conseguir forjar a autoria da marcação.
describe('BibleCourseController — conclusão fora do sistema (story 127)', () => {
  const user = { userId: 'u1', role: 'COORDINATOR', profileType: 'STAFF' };

  it('mark takes markedBy from the authenticated user', async () => {
    const s = svc();
    const c = new BibleCourseController(s as never);

    await c.markExternalCompletion('res1', user as never);

    expect(s.markExternalCompletion).toHaveBeenCalledWith('res1', 'u1');
  });

  it('mark falls back to a null author when the request has no user', async () => {
    const s = svc();
    const c = new BibleCourseController(s as never);

    await c.markExternalCompletion('res1', undefined as never);

    expect(s.markExternalCompletion).toHaveBeenCalledWith('res1', null);
  });

  it('unmark and get delegate to the service with the resident id', async () => {
    const s = svc();
    const c = new BibleCourseController(s as never);

    await c.unmarkExternalCompletion('res1');
    await c.findExternalCompletion('res1');

    expect(s.unmarkExternalCompletion).toHaveBeenCalledWith('res1');
    expect(s.findExternalCompletion).toHaveBeenCalledWith('res1');
  });
});
