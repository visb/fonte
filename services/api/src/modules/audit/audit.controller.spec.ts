import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  it('delegates findByTarget to the service', async () => {
    const findByTarget = jest.fn().mockResolvedValue([{ id: 'log-1' }]);
    const controller = new AuditController({ findByTarget } as unknown as AuditService);
    await expect(controller.findByTarget('resident', 'r1')).resolves.toEqual([
      { id: 'log-1' },
    ]);
    expect(findByTarget).toHaveBeenCalledWith('resident', 'r1');
  });
});
