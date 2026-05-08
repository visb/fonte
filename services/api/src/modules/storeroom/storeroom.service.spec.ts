jest.mock('@fonte/types', () => ({
  MovementType: {
    IN: 'IN',
    OUT: 'OUT',
  },
}));

import { MovementType } from '@fonte/types';
import { DataSource, Repository } from 'typeorm';
import { StoreroomService } from './storeroom.service';
import { StoreroomItem } from './storeroom.entity';
import { StoreroomMovement } from './storeroom-movement.entity';

describe('StoreroomService', () => {
  let dataSource: { query: jest.Mock };
  let service: StoreroomService;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    service = new StoreroomService(
      {} as Repository<StoreroomItem>,
      {} as Repository<StoreroomMovement>,
      dataSource as unknown as DataSource,
    );
  });

  it('consolidates weekly average usage for the previous 28 days', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([{ id: 'item-1' }, { id: 'item-2' }])
      .mockResolvedValueOnce([{ pg_advisory_unlock: true }]);

    const result = await service.consolidateWeeklyAverageUsage(new Date('2026-05-09T12:00:00Z'));

    expect(result).toEqual({
      skipped: false,
      windowStart: '2026-04-11',
      windowEnd: '2026-05-09',
      updatedItems: 2,
    });
    expect(dataSource.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('weekly_average_usage = ROUND((usage.total_quantity / $4)::numeric, 3)'),
      [MovementType.OUT, '2026-04-11', '2026-05-09', 4],
    );
    expect(dataSource.query.mock.calls[1][0]).toContain('LEFT JOIN storeroom_movements m');
    expect(dataSource.query.mock.calls[1][0]).toContain('AND m.type = $1');
    expect(dataSource.query.mock.calls[1][0]).toContain('AND m.date >= $2');
    expect(dataSource.query.mock.calls[1][0]).toContain('AND m.date < $3');
    expect(dataSource.query.mock.calls[1][0]).toContain('WHERE i.deleted_at IS NULL');
  });

  it('skips consolidation when advisory lock is not acquired', async () => {
    dataSource.query.mockResolvedValueOnce([{ acquired: false }]);

    const result = await service.consolidateWeeklyAverageUsage(new Date('2026-05-09T12:00:00Z'));

    expect(result).toEqual({
      skipped: true,
      windowStart: '2026-04-11',
      windowEnd: '2026-05-09',
      updatedItems: 0,
    });
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });

  it('releases advisory lock when consolidation fails', async () => {
    const error = new Error('database failed');
    dataSource.query
      .mockResolvedValueOnce([{ acquired: true }])
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce([{ pg_advisory_unlock: true }]);

    await expect(service.consolidateWeeklyAverageUsage(new Date('2026-05-09T12:00:00Z'))).rejects.toThrow(error);

    expect(dataSource.query).toHaveBeenNthCalledWith(
      3,
      `SELECT pg_advisory_unlock(hashtext($1))`,
      ['storeroom_weekly_average_usage'],
    );
  });
});
