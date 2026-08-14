import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Role } from '@fonte/types';
import { OfflineSnapshotQueryDto } from './dto/offline-snapshot-query.dto';
import { OfflineSyncController } from './offline-sync.controller';

const user = { userId: 'u1', role: Role.SERVANT, profileType: 'STAFF' };

describe('OfflineSyncController', () => {
  it('repassa casa, query e usuário ao service — sem regra própria', async () => {
    const service = { houseSnapshot: jest.fn().mockResolvedValue({ full: true }) };
    const controller = new OfflineSyncController(service as never);

    await controller.houseSnapshot('house-1', { since: '2026-08-01T00:00:00.000Z' }, user as never);

    expect(service.houseSnapshot).toHaveBeenCalledWith(
      'house-1',
      { since: '2026-08-01T00:00:00.000Z' },
      user,
    );
  });
});

describe('OfflineSnapshotQueryDto', () => {
  const parse = (value: unknown) =>
    validate(plainToInstance(OfflineSnapshotQueryDto, value as object));

  it('aceita ausência de since (pedido de sincronização completa)', async () => {
    await expect(parse({})).resolves.toEqual([]);
  });

  it('aceita ISO 8601 com fuso', async () => {
    await expect(parse({ since: '2026-08-11T09:12:03.000Z' })).resolves.toEqual([]);
  });

  it('recusa since malformado', async () => {
    const errors = await parse({ since: 'ontem' });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('since');
  });

  it('recusa data impossível em vez de deixar o Date normalizar em silêncio', async () => {
    // "2026-02-31" viraria 03/03 num `new Date`, e o delta usaria a janela errada.
    await expect(parse({ since: '2026-02-31' })).resolves.toHaveLength(1);
  });
});
