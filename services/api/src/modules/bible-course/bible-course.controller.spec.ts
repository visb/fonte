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
    enroll: jest.fn().mockResolvedValue({ id: 'en1' }),
    updateEnrollment: jest.fn().mockResolvedValue({ id: 'en1' }),
    removeEnrollment: jest.fn().mockResolvedValue(undefined),
    getClassGrades: jest.fn().mockResolvedValue([]),
    upsertGrade: jest.fn().mockResolvedValue({ id: 'gr1' }),
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
    await c.enroll('cl1', { residentId: 'res1' } as never);
    await c.updateEnrollment('en1', { status: 'DONE' } as never);
    await c.removeEnrollment('en1');
    await c.getClassGrades('cl1');
    await c.upsertGrade('en1', 'mod1', { grade: 9 } as never);
    expect(s.findAllClasses).toHaveBeenCalledWith('OPEN');
    expect(s.enroll).toHaveBeenCalledWith('cl1', { residentId: 'res1' });
    expect(s.upsertGrade).toHaveBeenCalledWith('en1', 'mod1', { grade: 9 });
  });
});
