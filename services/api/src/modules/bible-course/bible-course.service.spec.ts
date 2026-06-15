import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BibleCourseEnrollmentStatus } from '@fonte/types';
import { BibleCourseService } from './bible-course.service';
import { BibleCourseClass } from './bible-course-class.entity';
import { BibleCourseEnrollment } from './bible-course-enrollment.entity';
import { BibleCourseModule } from './bible-course-module.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}, queryImpl?: jest.Mock) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'class-1', ...v })),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    manager: { query: queryImpl ?? jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

function makeService(
  classRepo: ReturnType<typeof makeRepo>,
  enrollmentRepo = makeRepo(),
  moduleRepo = makeRepo(),
) {
  return new BibleCourseService(
    classRepo as unknown as Repository<BibleCourseClass>,
    enrollmentRepo as unknown as Repository<BibleCourseEnrollment>,
    moduleRepo as unknown as Repository<BibleCourseModule>,
  );
}

describe('BibleCourseService.findOneClass', () => {
  it('throws NotFound when the class row is missing', async () => {
    const classRepo = makeRepo({}, jest.fn().mockResolvedValue([])); // [row] = [] → row undefined
    const service = makeService(classRepo);
    await expect(service.findOneClass('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the class with its enrollments', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'class-1', name: 'Turma A' }]) // class row
      .mockResolvedValueOnce([{ id: 'e1', residentName: 'Filho' }]); // enrollments
    const classRepo = makeRepo({}, query);
    const service = makeService(classRepo);

    const result = await service.findOneClass('class-1');
    expect(result.enrollments).toHaveLength(1);
  });
});

describe('BibleCourseService.updateClass', () => {
  it('throws NotFound for a missing class', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.updateClass('nope', {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changes the status when provided', async () => {
    const classRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'class-1', status: 'OPEN' }) });
    const service = makeService(classRepo);

    await service.updateClass('class-1', { status: 'CLOSED' } as never);
    expect(classRepo.save.mock.calls[0][0].status).toBe('CLOSED');
  });
});

describe('BibleCourseService.enroll', () => {
  it('throws NotFound when the class is missing', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.enroll('nope', { residentId: 'res-1' } as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when the resident is missing', async () => {
    const classRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'class-1' }) }, jest.fn().mockResolvedValue([]));
    const service = makeService(classRepo);
    await expect(service.enroll('class-1', { residentId: 'nope' } as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a resident already enrolled', async () => {
    const classRepo = makeRepo(
      { findOne: jest.fn().mockResolvedValue({ id: 'class-1' }) },
      jest.fn().mockResolvedValue([{ id: 'res-1' }]),
    );
    const enrollmentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'e1' }) });
    const service = makeService(classRepo, enrollmentRepo);
    await expect(service.enroll('class-1', { residentId: 'res-1' } as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('enrolls a new resident', async () => {
    const classRepo = makeRepo(
      { findOne: jest.fn().mockResolvedValue({ id: 'class-1' }) },
      jest.fn().mockResolvedValue([{ id: 'res-1' }]),
    );
    const enrollmentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(classRepo, enrollmentRepo);

    await service.enroll('class-1', { residentId: 'res-1' } as never);
    expect(enrollmentRepo.save).toHaveBeenCalled();
  });
});

describe('BibleCourseService.updateEnrollment', () => {
  it('stamps completedAt when status becomes COMPLETED', async () => {
    const enrollmentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'e1' }) });
    const service = makeService(makeRepo(), enrollmentRepo);

    await service.updateEnrollment('e1', { status: BibleCourseEnrollmentStatus.COMPLETED } as never);
    expect(enrollmentRepo.save.mock.calls[0][0].completedAt).toBeInstanceOf(Date);
  });

  it('clears completedAt for a non-completed status', async () => {
    const enrollmentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'e1', completedAt: new Date() }) });
    const service = makeService(makeRepo(), enrollmentRepo);

    await service.updateEnrollment('e1', { status: BibleCourseEnrollmentStatus.ENROLLED } as never);
    expect(enrollmentRepo.save.mock.calls[0][0].completedAt).toBeNull();
  });
});

describe('BibleCourseService modules (catalogo)', () => {
  it('lists modules ordered by sequence then name', async () => {
    const find = jest.fn().mockResolvedValue([{ id: 'm1' }]);
    const moduleRepo = makeRepo({ find });
    const service = makeService(makeRepo(), makeRepo(), moduleRepo);

    const result = await service.findAllModules();
    expect(result).toHaveLength(1);
    expect(find).toHaveBeenCalledWith({ order: { sequence: 'ASC', name: 'ASC' } });
  });

  it('creates a module defaulting sequence to 0', async () => {
    const moduleRepo = makeRepo();
    const service = makeService(makeRepo(), makeRepo(), moduleRepo);

    await service.createModule({ name: 'Gênesis' } as never);
    expect(moduleRepo.create.mock.calls[0][0]).toMatchObject({ name: 'Gênesis', sequence: 0, notes: null });
    expect(moduleRepo.save).toHaveBeenCalled();
  });

  it('throws NotFound updating a missing module', async () => {
    const moduleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeRepo(), makeRepo(), moduleRepo);
    await expect(service.updateModule('nope', { name: 'X' } as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a module name and sequence', async () => {
    const moduleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1', name: 'A', sequence: 0 }) });
    const service = makeService(makeRepo(), makeRepo(), moduleRepo);

    await service.updateModule('m1', { name: 'Êxodo', sequence: 2 } as never);
    expect(moduleRepo.save.mock.calls[0][0]).toMatchObject({ name: 'Êxodo', sequence: 2 });
  });

  it('throws NotFound removing a missing module', async () => {
    const moduleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeRepo(), makeRepo(), moduleRepo);
    await expect(service.removeModule('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes an existing module', async () => {
    const moduleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const service = makeService(makeRepo(), makeRepo(), moduleRepo);

    await service.removeModule('m1');
    expect(moduleRepo.softDelete).toHaveBeenCalledWith('m1');
  });
});
