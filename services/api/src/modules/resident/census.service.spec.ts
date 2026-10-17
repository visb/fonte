import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotificationType, ResidentStatus, Role } from '@fonte/types';
import { CensusService } from './census.service';
import { Resident } from './resident.entity';
import { ResidentService } from './resident.service';
import { House } from '../house/house.entity';
import { Staff } from '../staff/staff.entity';
import { NotificationService } from '../notification/notification.service';
import { createAuditHarness, repoMap } from '../audit/testing/audit-harness.testkit-spec';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

function makeService(
  residentRepo = makeRepo(),
  houseRepo = makeRepo(),
  staffRepo = makeRepo(),
  residentService: Partial<ResidentService> = {
    create: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  notifications: Partial<NotificationService> = { create: jest.fn().mockResolvedValue({}) },
) {
  // Story 199 — AuditService real sobre manager fake.
  const audit = createAuditHarness(repoMap([[Resident, residentRepo]]));
  const service = new CensusService(
    residentRepo as unknown as Repository<Resident>,
    houseRepo as unknown as Repository<House>,
    staffRepo as unknown as Repository<Staff>,
    residentService as ResidentService,
    notifications as NotificationService,
    audit.audit,
  );
  return { service, residentRepo, houseRepo, staffRepo, residentService, notifications, audit };
}

const HOUSE = { id: 'house-1', name: 'Casa Esperança' };
const STAFF = { id: 'staff-1', name: 'João', userId: 'user-1' };

describe('CensusService.addResident', () => {
  it('creates the resident as CENSUS_ADDED and notifies the ADMIN', async () => {
    const created = { id: 'res-1', name: 'Novo Filho', houseId: 'house-1' };
    const residentService = {
      create: jest.fn().mockResolvedValue(created),
      update: jest.fn(),
    };
    const houseRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(HOUSE) });
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(STAFF) });
    const { service, notifications } = makeService(
      makeRepo(),
      houseRepo,
      staffRepo,
      residentService,
    );

    await service.addResident(
      { name: 'Novo Filho', houseId: 'house-1' } as never,
      'user-1',
    );

    expect(residentService.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: ResidentStatus.CENSUS_ADDED, houseId: 'house-1' }),
      undefined,
      // Story 199: a criação entra na trilha como inclusão na contagem.
      { auditAction: 'census.resident.add' },
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.CENSUS_RESIDENT_ADDED,
        recipientRole: Role.ADMIN,
      }),
    );
  });

  it('still resolves when the notification fails (best-effort)', async () => {
    const residentService = {
      create: jest.fn().mockResolvedValue({ id: 'r', name: 'x', houseId: 'house-1' }),
      update: jest.fn(),
    };
    const notifications = { create: jest.fn().mockRejectedValue(new Error('down')) };
    const { service } = makeService(
      makeRepo(),
      makeRepo({ findOne: jest.fn().mockResolvedValue(HOUSE) }),
      makeRepo({ findOne: jest.fn().mockResolvedValue(STAFF) }),
      residentService,
      notifications,
    );

    await expect(
      service.addResident({ name: 'x', houseId: 'house-1' } as never, 'user-1'),
    ).resolves.toBeDefined();
  });
});

describe('CensusService.conclude', () => {
  it('emits CENSUS_CONCLUDED with the count of added residents', async () => {
    const houseRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(HOUSE) });
    const residentRepo = makeRepo({ count: jest.fn().mockResolvedValue(2) });
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(STAFF) });
    const { service, notifications, audit } = makeService(residentRepo, houseRepo, staffRepo);

    const result = await service.conclude(
      { houseId: 'house-1', confirmedCount: 5, total: 5 },
      'user-1',
    );

    expect(result.addedCount).toBe(2);
    // Story 199: conclusão é evento sem diff, com os números da contagem.
    expect(audit.inserted).toEqual([
      expect.objectContaining({
        action: 'census.conclude',
        targetType: 'house',
        targetId: 'house-1',
        houseId: 'house-1',
        changes: null,
        context: { confirmedCount: 5, total: 5, addedCount: 2 },
      }),
    ]);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.CENSUS_CONCLUDED,
        recipientRole: Role.ADMIN,
        metadata: expect.objectContaining({ addedCount: 2 }),
      }),
    );
  });
});

describe('CensusService.approveAll', () => {
  it('transitions every pending resident to ACTIVE', async () => {
    const residentRepo = makeRepo({
      find: jest.fn().mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]),
    });
    const residentService = { create: jest.fn(), update: jest.fn().mockResolvedValue({}) };
    const { service } = makeService(residentRepo, makeRepo(), makeRepo(), residentService);

    const result = await service.approveAll('house-1');

    expect(result.approved).toBe(2);
    // Story 199: um evento `census.approve` por filho (correlação = a requisição).
    expect(residentService.update).toHaveBeenCalledWith(
      'r1',
      { status: ResidentStatus.ACTIVE },
      { auditAction: 'census.approve' },
    );
    expect(residentService.update).toHaveBeenCalledWith(
      'r2',
      { status: ResidentStatus.ACTIVE },
      { auditAction: 'census.approve' },
    );
  });
});

describe('CensusService.reject', () => {
  it('sets the resident to REJECTED_CENSUS', async () => {
    const pending = { id: 'r1', status: ResidentStatus.CENSUS_ADDED, houseId: 'house-1' };
    const rejected = { ...pending, status: ResidentStatus.REJECTED_CENSUS };
    const residentRepo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(pending) // checagem do service
        .mockResolvedValueOnce(pending) // antes (auditoria)
        .mockResolvedValueOnce(rejected) // depois (auditoria)
        .mockResolvedValueOnce(rejected), // resposta
    });
    const { service, audit } = makeService(residentRepo);

    const result = await service.reject('r1');

    expect(residentRepo.update).toHaveBeenCalledWith('r1', {
      status: ResidentStatus.REJECTED_CENSUS,
    });
    expect(result.status).toBe(ResidentStatus.REJECTED_CENSUS);
    expect(audit.inserted).toEqual([
      expect.objectContaining({
        action: 'census.reject',
        targetType: 'resident',
        targetId: 'r1',
        houseId: 'house-1',
        changes: [{ field: 'status', before: 'CENSUS_ADDED', after: 'REJECTED_CENSUS', redacted: false }],
      }),
    ]);
  });

  it('throws Conflict when the resident is not CENSUS_ADDED', async () => {
    const residentRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'r1', status: ResidentStatus.ACTIVE }),
    });
    const { service } = makeService(residentRepo);

    await expect(service.reject('r1')).rejects.toBeInstanceOf(ConflictException);
    expect(residentRepo.update).not.toHaveBeenCalled();
  });
});
