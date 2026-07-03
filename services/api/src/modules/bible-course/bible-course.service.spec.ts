import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BibleCourseEnrollmentStatus } from '@fonte/types';
import { BibleCourseService, ELIGIBLE_TREATMENT_MONTHS } from './bible-course.service';
import { BibleCourseClass } from './bible-course-class.entity';
import { BibleCourseEnrollment } from './bible-course-enrollment.entity';
import { BibleCourseModule } from './bible-course-module.entity';
import { BibleCourseGrade } from './bible-course-grade.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}, queryImpl?: jest.Mock) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'class-1', ...v })),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
    manager: { query: queryImpl ?? jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

function makeService(
  classRepo: ReturnType<typeof makeRepo>,
  enrollmentRepo = makeRepo(),
  moduleRepo = makeRepo(),
  gradeRepo = makeRepo(),
) {
  return new BibleCourseService(
    classRepo as unknown as Repository<BibleCourseClass>,
    enrollmentRepo as unknown as Repository<BibleCourseEnrollment>,
    moduleRepo as unknown as Repository<BibleCourseModule>,
    gradeRepo as unknown as Repository<BibleCourseGrade>,
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

describe('BibleCourseService.monthsBetween', () => {
  it('counts full calendar months', () => {
    expect(
      BibleCourseService.monthsBetween(
        new Date('2026-01-10T00:00:00'),
        new Date('2026-04-10T00:00:00'),
      ),
    ).toBe(3);
  });

  it('does not count the current month until the day-of-month is reached', () => {
    expect(
      BibleCourseService.monthsBetween(
        new Date('2026-01-20T00:00:00'),
        new Date('2026-04-10T00:00:00'),
      ),
    ).toBe(2);
  });

  it('spans years', () => {
    expect(
      BibleCourseService.monthsBetween(
        new Date('2025-11-01T00:00:00'),
        new Date('2026-05-01T00:00:00'),
      ),
    ).toBe(6);
  });
});

describe('BibleCourseService.findEligibleResidents', () => {
  function eligibleQuery() {
    return jest.fn().mockResolvedValue([
      {
        id: 'r-old',
        name: 'Filho Antigo',
        photoThumbUrl: 'thumb.jpg',
        entryDate: '2026-01-01',
        houseId: 'h1',
        houseName: 'Casa 1',
      },
      {
        id: 'r-new',
        name: 'Filho Recente',
        photoThumbUrl: null,
        entryDate: '2026-03-01',
        houseId: 'h2',
        houseName: null,
      },
    ]);
  }

  it('defaults to ELIGIBLE_TREATMENT_MONTHS when no months given', async () => {
    const query = eligibleQuery();
    const service = makeService(makeRepo({}, query));
    await service.findEligibleResidents();
    expect(query.mock.calls[0][1]).toEqual([ELIGIBLE_TREATMENT_MONTHS]);
  });

  it('forwards a custom months param', async () => {
    const query = eligibleQuery();
    const service = makeService(makeRepo({}, query));
    await service.findEligibleResidents(7);
    expect(query.mock.calls[0][1]).toEqual([7]);
  });

  it('filters by active/discipline status, null exit_date, treatment time and no active enrollment', async () => {
    const query = eligibleQuery();
    const service = makeService(makeRepo({}, query));
    await service.findEligibleResidents(3);
    const sql = query.mock.calls[0][0] as string;
    // status ∈ {ACTIVE, DISCIPLINE} → any casa (no house filter), exit_date null.
    expect(sql).toContain("r.status IN ('ACTIVE', 'DISCIPLINE')");
    expect(sql).toContain('r.exit_date IS NULL');
    expect(sql).not.toContain('r.house_id = $');
    // entryDate <= hoje − months.
    expect(sql).toContain("r.entry_date <= (CURRENT_DATE - ($1::int * INTERVAL '1 month'))");
    // exclui quem já tem matrícula ativa (não desistente) em turma não deletada.
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain("e.status <> 'DROPPED'");
    // ordena por entryDate asc.
    expect(sql).toContain('ORDER BY r.entry_date ASC');
  });

  it('maps rows preserving order and computing monthsInTreatment', async () => {
    const query = eligibleQuery();
    const service = makeService(makeRepo({}, query));
    const result = await service.findEligibleResidents(3);

    expect(result.map((r) => r.id)).toEqual(['r-old', 'r-new']);
    expect(result[0]).toMatchObject({
      id: 'r-old',
      name: 'Filho Antigo',
      photoThumbUrl: 'thumb.jpg',
      entryDate: '2026-01-01',
      houseId: 'h1',
      houseName: 'Casa 1',
    });
    expect(result[0].monthsInTreatment).toBeGreaterThanOrEqual(3);
    // houseName cai para string vazia quando a casa é nula.
    expect(result[1].houseName).toBe('');
  });
});

describe('BibleCourseService.enrollBulk', () => {
  function makeTxManager(overrides: Record<string, jest.Mock> = {}) {
    return {
      query: jest.fn().mockResolvedValue([{ id: 'ok' }]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((_entity, v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'e-new', ...v })),
      ...overrides,
    };
  }

  function enrollmentRepoWithTx(manager: ReturnType<typeof makeTxManager>) {
    const repo = makeRepo();
    repo.manager = {
      query: jest.fn().mockResolvedValue([]),
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    } as never;
    return repo;
  }

  it('throws NotFound when the class is missing', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.enrollBulk('nope', ['r1'])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('enrolls N residents in a single transaction', async () => {
    const classRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'c1' }) });
    const manager = makeTxManager();
    const enrollmentRepo = enrollmentRepoWithTx(manager);
    const service = makeService(classRepo, enrollmentRepo);

    const result = await service.enrollBulk('c1', ['r1', 'r2']);
    expect(
      (enrollmentRepo.manager as unknown as { transaction: jest.Mock }).transaction,
    ).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ enrolled: 2 });
  });

  it('deduplicates repeated ids', async () => {
    const classRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'c1' }) });
    const manager = makeTxManager();
    const enrollmentRepo = enrollmentRepoWithTx(manager);
    const service = makeService(classRepo, enrollmentRepo);

    const result = await service.enrollBulk('c1', ['r1', 'r1', 'r1']);
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ enrolled: 1 });
  });

  it('skips a resident already enrolled in the class', async () => {
    const classRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'c1' }) });
    const manager = makeTxManager({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'existing' }) // r1 already enrolled
        .mockResolvedValueOnce(null), // r2 new
    });
    const enrollmentRepo = enrollmentRepoWithTx(manager);
    const service = makeService(classRepo, enrollmentRepo);

    const result = await service.enrollBulk('c1', ['r1', 'r2']);
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ enrolled: 1 });
  });

  it('rolls back (throws) when a resident does not exist', async () => {
    const classRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'c1' }) });
    const manager = makeTxManager({
      query: jest.fn().mockResolvedValue([]), // resident lookup returns nothing
    });
    const enrollmentRepo = enrollmentRepoWithTx(manager);
    const service = makeService(classRepo, enrollmentRepo);

    await expect(service.enrollBulk('c1', ['ghost'])).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.save).not.toHaveBeenCalled();
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

describe('BibleCourseService.average', () => {
  it('returns null when there is nothing to average', () => {
    expect(BibleCourseService.average([null, undefined])).toBeNull();
  });

  it('ignores nulls and averages only present values', () => {
    expect(BibleCourseService.average([8, null])).toBe(8);
    expect(BibleCourseService.average([7, 9])).toBe(8);
    expect(BibleCourseService.average([null, 5])).toBe(5);
  });

  it('rounds to two decimals', () => {
    expect(BibleCourseService.average([10, 9, 9])).toBe(9.33);
  });
});

describe('BibleCourseService.upsertGrade', () => {
  it('throws NotFound when the enrollment is missing', async () => {
    const enrollmentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeRepo(), enrollmentRepo);
    await expect(
      service.upsertGrade('nope', 'm1', { examGrade: 8 } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when the module is missing', async () => {
    const enrollmentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'e1' }) });
    const moduleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeRepo(), enrollmentRepo, moduleRepo);
    await expect(
      service.upsertGrade('e1', 'nope', { examGrade: 8 } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a new grade row when none exists', async () => {
    const enrollmentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'e1' }) });
    const moduleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const gradeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeRepo(), enrollmentRepo, moduleRepo, gradeRepo);

    await service.upsertGrade('e1', 'm1', { examGrade: 8, workGrade: 9 } as never);
    expect(gradeRepo.create).toHaveBeenCalled();
    expect(gradeRepo.save.mock.calls[0][0]).toMatchObject({
      enrollmentId: 'e1',
      moduleId: 'm1',
      examGrade: 8,
      workGrade: 9,
    });
  });

  it('edits the existing row instead of duplicating', async () => {
    const enrollmentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'e1' }) });
    const moduleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const existing = { id: 'g1', enrollmentId: 'e1', moduleId: 'm1', examGrade: 5, workGrade: null };
    const gradeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(existing) });
    const service = makeService(makeRepo(), enrollmentRepo, moduleRepo, gradeRepo);

    await service.upsertGrade('e1', 'm1', { examGrade: 7 } as never);
    expect(gradeRepo.create).not.toHaveBeenCalled();
    expect(gradeRepo.save.mock.calls[0][0]).toMatchObject({ id: 'g1', examGrade: 7, workGrade: null });
  });

  it('clears a grade when null is sent', async () => {
    const enrollmentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'e1' }) });
    const moduleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const existing = { id: 'g1', enrollmentId: 'e1', moduleId: 'm1', examGrade: 5, workGrade: 6 };
    const gradeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(existing) });
    const service = makeService(makeRepo(), enrollmentRepo, moduleRepo, gradeRepo);

    await service.upsertGrade('e1', 'm1', { examGrade: null } as never);
    expect(gradeRepo.save.mock.calls[0][0]).toMatchObject({ examGrade: null, workGrade: 6 });
  });
});

describe('BibleCourseService.getClassGrades', () => {
  it('throws NotFound when the class is missing', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.getClassGrades('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('builds the matrix with per-module and overall averages ignoring blanks', async () => {
    const classRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'c1' }) });
    const moduleRepo = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'm1', name: 'Gênesis', sequence: 1 },
        { id: 'm2', name: 'Êxodo', sequence: 2 },
      ]),
    });
    const enrollmentRepo = makeRepo(
      {},
      jest.fn().mockResolvedValue([{ id: 'e1', residentName: 'Filho' }]),
    );
    const gradeRepo = makeRepo();
    gradeRepo.createQueryBuilder = jest.fn(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        // m1: exam 8, work 10 → avg 9 ; m2: exam 6, work null → avg 6
        { enrollmentId: 'e1', moduleId: 'm1', examGrade: '8', workGrade: '10' },
        { enrollmentId: 'e1', moduleId: 'm2', examGrade: '6', workGrade: null },
      ]),
    })) as never;

    const service = makeService(classRepo, enrollmentRepo, moduleRepo, gradeRepo);
    const result = await service.getClassGrades('c1');

    expect(result.modules).toHaveLength(2);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.modules[0]).toMatchObject({ moduleId: 'm1', examGrade: 8, workGrade: 10, moduleAverage: 9 });
    expect(row.modules[1]).toMatchObject({ moduleId: 'm2', examGrade: 6, workGrade: null, moduleAverage: 6 });
    // student average = avg(9, 6) = 7.5
    expect(row.average).toBe(7.5);
  });

  it('reports a null average for an enrollment without any grade', async () => {
    const classRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'c1' }) });
    const moduleRepo = makeRepo({
      find: jest.fn().mockResolvedValue([{ id: 'm1', name: 'Gênesis', sequence: 1 }]),
    });
    const enrollmentRepo = makeRepo(
      {},
      jest.fn().mockResolvedValue([{ id: 'e1', residentName: 'Filho' }]),
    );
    const service = makeService(classRepo, enrollmentRepo, moduleRepo);

    const result = await service.getClassGrades('c1');
    expect(result.rows[0].average).toBeNull();
    expect(result.rows[0].modules[0].moduleAverage).toBeNull();
  });
});
