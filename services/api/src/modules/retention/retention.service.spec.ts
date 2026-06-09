import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RetentionService } from './retention.service';
import { DataRightsService } from '../data-rights/data-rights.service';

function makeService(opts: {
  ids?: { id: string }[];
  anonymize?: jest.Mock;
  config?: Record<string, unknown>;
}) {
  const dataSource = { query: jest.fn().mockResolvedValue(opts.ids ?? []) } as unknown as DataSource;
  const dataRights = { anonymizeResident: opts.anonymize ?? jest.fn().mockResolvedValue(undefined) } as unknown as DataRightsService;
  const config = { get: (k: string) => (opts.config ?? {})[k] } as unknown as ConfigService;
  return { service: new RetentionService(dataSource, dataRights, config), dataSource, dataRights };
}

describe('RetentionService.purgeExpired', () => {
  it('anonymizes each expired resident and counts them', async () => {
    const anonymize = jest.fn().mockResolvedValue(undefined);
    const { service } = makeService({ ids: [{ id: 'r1' }, { id: 'r2' }], anonymize });

    const result = await service.purgeExpired();

    expect(result).toEqual({ anonymized: 2 });
    expect(anonymize).toHaveBeenCalledWith('r1');
    expect(anonymize).toHaveBeenCalledWith('r2');
  });

  it('continues when one anonymization fails (best-effort)', async () => {
    const anonymize = jest.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const { service } = makeService({ ids: [{ id: 'r1' }, { id: 'r2' }], anonymize });

    const result = await service.purgeExpired();

    expect(result).toEqual({ anonymized: 1 });
  });

  it('uses the configured retention window in the query', async () => {
    const { service, dataSource } = makeService({ config: { LGPD_RETENTION_DAYS: 30 } });
    await service.findExpiredResidentIds();
    expect((dataSource.query as jest.Mock)).toHaveBeenCalledWith(expect.any(String), ['30']);
  });
});

describe('RetentionService.scheduledPurge', () => {
  it('does nothing when retention is disabled', async () => {
    const anonymize = jest.fn();
    const { service } = makeService({ ids: [{ id: 'r1' }], anonymize, config: { LGPD_RETENTION_ENABLED: 'false' } });
    await service.scheduledPurge();
    expect(anonymize).not.toHaveBeenCalled();
  });

  it('runs when enabled', async () => {
    const anonymize = jest.fn().mockResolvedValue(undefined);
    const { service } = makeService({ ids: [{ id: 'r1' }], anonymize, config: { LGPD_RETENTION_ENABLED: 'true' } });
    await service.scheduledPurge();
    expect(anonymize).toHaveBeenCalledWith('r1');
  });
});
