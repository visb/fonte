import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '@fonte/types';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditQueryService } from './audit-query.service';
import { ListAuditEventsDto } from './dto/list-audit-events.dto';

describe('AuditController', () => {
  function make() {
    const findByTarget = jest.fn().mockResolvedValue([{ id: 'log-1' }]);
    const list = jest.fn().mockResolvedValue({ items: [], nextCursor: null });
    const findOne = jest.fn().mockResolvedValue({ id: 'e1' });
    const controller = new AuditController(
      { findByTarget } as unknown as AuditService,
      { list, findOne } as unknown as AuditQueryService,
    );
    return { controller, findByTarget, list, findOne };
  }

  it('delegates findByTarget to the service (contrato legado)', async () => {
    const { controller, findByTarget } = make();
    await expect(controller.findByTarget('resident', 'r1')).resolves.toEqual([{ id: 'log-1' }]);
    expect(findByTarget).toHaveBeenCalledWith('resident', 'r1');
  });

  it('delegates list and detail to the query service', async () => {
    const { controller, list, findOne } = make();
    await controller.list({ limit: 10 });
    await controller.findOne('e1');
    expect(list).toHaveBeenCalledWith({ limit: 10 });
    expect(findOne).toHaveBeenCalledWith('e1');
  });

  it('a trilha inteira é exclusiva de ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AuditController)).toEqual([Role.ADMIN]);
  });
});

describe('ListAuditEventsDto', () => {
  const check = (input: Record<string, unknown>) =>
    validate(plainToInstance(ListAuditEventsDto, input), { forbidUnknownValues: true });

  it('aceita filtros válidos', async () => {
    const errors = await check({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-17T00:00:00.000Z',
      userId: '6f1c3b8e-1d2a-4b9c-9e8f-0a1b2c3d4e5f',
      houseId: '6f1c3b8e-1d2a-4b9c-9e8f-0a1b2c3d4e5f',
      action: 'resident.update',
      targetType: 'resident-receivable',
      outcome: 'FAILURE',
      limit: '100',
    });
    expect(errors).toHaveLength(0);
  });

  it.each([
    [{ from: 'ontem' }],
    [{ limit: '0' }],
    [{ limit: '101' }],
    [{ userId: 'nao-uuid' }],
    [{ outcome: 'MAYBE' }],
    [{ action: 'DROP TABLE' }],
  ])('recusa %j', async (input) => {
    expect((await check(input)).length).toBeGreaterThan(0);
  });
});
