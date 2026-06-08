import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './audit-log.entity';

function makeService(repo: Partial<Repository<AuditLog>>) {
  return new AuditService(repo as Repository<AuditLog>);
}

describe('AuditService.record', () => {
  it('inserts an audit entry with normalized nulls', async () => {
    const insert = jest.fn().mockResolvedValue(undefined);
    const service = makeService({ insert: insert as never });

    await service.record({ action: 'resident.read', targetId: 'r1', userId: 'u1', role: 'ADMIN' });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'resident.read',
        targetId: 'r1',
        userId: 'u1',
        role: 'ADMIN',
        targetType: null,
        path: null,
      }),
    );
  });

  it('never throws when the insert fails (best-effort)', async () => {
    const insert = jest.fn().mockRejectedValue(new Error('db down'));
    const service = makeService({ insert: insert as never });

    await expect(service.record({ action: 'resident.read' })).resolves.toBeUndefined();
  });
});

describe('AuditService.findByTarget', () => {
  it('queries by target ordered by createdAt DESC, capped at 200', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const service = makeService({ find: find as never });

    await service.findByTarget('resident', 'r1');

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { targetType: 'resident', targetId: 'r1' },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
    );
  });
});
