// Story 199 — casas (dados, fotos, regras) e ministérios (dados, vínculos de
// filhos e servos, inclusive remoção de filho do ministério) na trilha.
import { HouseService } from './house.service';
import { House } from './house.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseRule } from './house-rule.entity';
import { MinistryService } from '../ministry/ministry.service';
import { Ministry } from '../ministry/ministry.entity';
import { MinistryStaff } from '../ministry/ministry-staff.entity';
import { Resident } from '../resident/resident.entity';
import { createAuditHarness, memoryRepo, repoMap } from '../audit/testing/audit-harness.testkit-spec';

describe('HouseService — auditoria (story 199)', () => {
  function setup() {
    const houses = { ...memoryRepo([{ id: 'h1', name: 'Casa A', city: 'X', isMotherHouse: false }]), manager: { query: jest.fn().mockResolvedValue([]) } };
    const photos = memoryRepo();
    const rules = memoryRepo();
    const harness = createAuditHarness(
      repoMap([
        [House, houses],
        [HousePhoto, photos],
        [HouseRule, rules],
      ]),
    );
    const storage = {
      upload: jest.fn().mockResolvedValue('https://bucket/h.jpg'),
      delete: jest.fn().mockResolvedValue(undefined),
      uniqueFilename: jest.fn((n: string) => n),
    };
    const service = new HouseService(houses as never, photos as never, rules as never, storage as never, harness.audit);
    return { service, harness };
  }

  it('criação/edição/remoção: a própria casa é a casa do evento', async () => {
    const s = setup();
    const created = await s.service.create({ name: 'Casa Nova' } as never);
    await s.service.update('h1', { name: 'Casa A2' } as never).catch(() => undefined);
    await s.service.remove('h1');
    expect(s.harness.inserted.map((e) => [e.action, e.targetId, e.houseId, e.changedFields])).toEqual([
      ['house.create', created.id, created.id, ['name']],
      ['house.update', 'h1', 'h1', ['name']],
      ['house.delete', 'h1', 'h1', ['name', 'city', 'isMotherHouse']],
    ]);
  });

  it('foto e regra: casa como recurso principal, foto sem URL', async () => {
    const s = setup();
    const photo = await s.service.addPhoto('h1', { originalname: 'f.jpg', buffer: Buffer.from('x'), mimetype: 'image/jpeg' } as never);
    await s.service.removePhoto('h1', photo.id);
    const rule = await s.service.createRule('h1', { title: 'Silêncio', content: 'Após 22h' } as never);
    await s.service.removeRule('h1', rule.id);
    expect(s.harness.inserted.map((e) => [e.action, e.parentType, e.parentId, e.houseId])).toEqual([
      ['house.photo.add', 'house', 'h1', 'h1'],
      ['house.photo.remove', 'house', 'h1', 'h1'],
      ['house.rule.create', 'house', 'h1', 'h1'],
      ['house.rule.delete', 'house', 'h1', 'h1'],
    ]);
    expect(JSON.stringify(s.harness.inserted)).not.toContain('bucket');
  });
});

describe('MinistryService — auditoria (story 199)', () => {
  function setup() {
    const residents = memoryRepo([
      { id: 'r1', status: 'ACTIVE', houseId: 'h1', ministryId: null },
      { id: 'r2', status: 'ACTIVE', houseId: 'h1', ministryId: 'm1' },
    ]);
    const ministryQuery = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT id, house_id, status FROM residents')) {
        const r = await residents.findOne({ where: { id: params[0] } });
        return r ? [{ id: r.id, house_id: r.houseId, status: r.status }] : [];
      }
      return [];
    });
    const ministries = { ...memoryRepo([{ id: 'm1', name: 'Horta', houseId: 'h1', leaderId: null, leaderType: null }]), manager: { query: ministryQuery } };
    const links = memoryRepo();
    // Consultas cruas da transação (vínculo filho↔ministério) aplicadas ao repo em memória.
    const txQuery = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('UPDATE residents SET ministry_id = $1 WHERE id = $2')) {
        await residents.update(params[1] as string, { ministryId: params[0] });
      } else if (sql.startsWith('UPDATE residents SET ministry_id = NULL WHERE id = $1')) {
        const r = await residents.findOne({ where: { id: params[0] } });
        if (r?.ministryId === params[1]) await residents.update(params[0] as string, { ministryId: null });
      } else if (sql.startsWith('SELECT id, house_id FROM residents WHERE ministry_id')) {
        return [...residents.table.values()]
          .filter((r) => r.ministryId === params[0])
          .map((r) => ({ id: r.id, house_id: r.houseId }));
      }
      return [];
    });
    const harness = createAuditHarness(
      repoMap([
        [Ministry, ministries],
        [MinistryStaff, links],
        [Resident, residents],
      ]),
      txQuery,
    );
    const service = new MinistryService(ministries as never, links as never, memoryRepo() as never, harness.audit);
    return { service, harness };
  }

  it('criação e edição do ministério carregam a casa dele', async () => {
    const s = setup();
    await s.service.create('h1', { name: 'Cozinha' } as never);
    await s.service.update('m1', { name: 'Horta Nova' } as never);
    expect(s.harness.inserted.map((e) => [e.action, e.houseId, e.changedFields])).toEqual([
      ['ministry.create', 'h1', ['name']],
      ['ministry.update', 'h1', ['name']],
    ]);
  });

  it('filho entra e sai do ministério pela ficha (ministryId), ministério como principal', async () => {
    const s = setup();
    await s.service.addResident('m1', 'r1');
    await s.service.removeResident('m1', 'r1');
    await s.service.removeResident('m1', 'r1'); // já fora: no-op, sem evento
    expect(s.harness.inserted).toEqual([
      expect.objectContaining({
        action: 'ministry.resident.add',
        targetType: 'resident',
        targetId: 'r1',
        houseId: 'h1',
        parentType: 'ministry',
        parentId: 'm1',
        changes: [{ field: 'ministryId', before: null, after: 'm1', redacted: false }],
      }),
      expect.objectContaining({
        action: 'ministry.resident.remove',
        changes: [{ field: 'ministryId', before: 'm1', after: null, redacted: false }],
      }),
    ]);
  });

  it('servo entra e sai: vínculo como diff do ministério, servo como principal', async () => {
    const s = setup();
    await s.service.addStaff('m1', 's1');
    await s.service.removeStaff('m1', 's1');
    expect(s.harness.inserted.map((e) => [e.action, e.targetId, e.parentId, e.changes])).toEqual([
      ['ministry.staff.add', 'm1', 's1', [{ field: 'staffId', before: null, after: 's1', redacted: false }]],
      ['ministry.staff.remove', 'm1', 's1', [{ field: 'staffId', before: 's1', after: null, redacted: false }]],
    ]);
  });

  it('remoção do ministério: um evento por filho desvinculado + o do ministério, mesma transação', async () => {
    const s = setup();
    await s.service.remove('m1');
    expect(s.harness.inserted.map((e) => [e.action, e.targetId])).toEqual([
      ['ministry.resident.remove', 'r2'],
      ['ministry.delete', 'm1'],
    ]);
    expect(s.harness.dataSource.transaction).toHaveBeenCalledTimes(1);
  });
});
