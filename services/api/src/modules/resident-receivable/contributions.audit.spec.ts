// Story 199 — contribuições do filho (parcela paga/reaberta, lançamentos pelo
// acompanhamento, inclusive em lote), comprovante, vínculos familiares e
// declaração/remoção de produtos recebidos: autor, alvo, filho, casa e diff.
import { ResidentReceivableService } from './resident-receivable.service';
import { ResidentReceivable } from './resident-receivable.entity';
import { ReceivableProductContributionService } from './receivable-product-contribution.service';
import { ReceivableProductContribution } from './receivable-product-contribution.entity';
import { ResidentFollowUpService } from '../resident-follow-up/resident-follow-up.service';
import { ResidentFollowUp } from '../resident-follow-up/resident-follow-up.entity';
import { RelativeService } from '../relative/relative.service';
import { Relative } from '../relative/relative.entity';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';
import { createAuditHarness, memoryRepo, repoMap } from '../audit/testing/audit-harness.testkit-spec';

/** `SELECT house_id FROM residents ...` → casa do filho r1. */
const houseQuery = () =>
  jest.fn(async (sql: string) => (sql.includes('house_id FROM residents') ? [{ house_id: 'h1' }] : []));

describe('Parcelas — auditoria (story 199)', () => {
  function setup() {
    const receivables = memoryRepo([
      { id: 'rc1', residentId: 'r1', amount: 700, status: 'PENDING', paidAt: null, attachmentUrl: null, notes: null },
    ]);
    const harness = createAuditHarness(repoMap([[ResidentReceivable, receivables]]), houseQuery());
    const service = new ResidentReceivableService(
      receivables as never,
      { findOne: jest.fn().mockResolvedValue({ name: 'Filho' }) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'st1' }) } as never,
      {
        upload: jest.fn().mockResolvedValue('https://bucket/c.pdf'),
        delete: jest.fn(),
        uniqueFilename: jest.fn((n: string) => n),
      } as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      { mapByReceivables: jest.fn().mockResolvedValue(new Map()) } as never,
      harness.audit,
    );
    return { service, harness };
  }

  it('pagamento com comprovante e reabertura: filho como principal, casa do filho, sem URL/observação', async () => {
    const s = setup();
    await s.service.registerPayment(
      'r1',
      'rc1',
      { paidAt: '2026-10-10', paymentMethod: 'PIX', notes: 'pago pela mãe Maria' } as never,
      'u1',
      { originalname: 'c.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf' } as never,
    );
    await s.service.reopenPayment('r1', 'rc1');
    expect(s.harness.inserted.map((e) => [e.action, e.targetType, e.parentId, e.houseId])).toEqual([
      ['resident.receivable.payment', 'resident-receivable', 'r1', 'h1'],
      ['resident.receivable.reopen', 'resident-receivable', 'r1', 'h1'],
    ]);
    expect(s.harness.inserted[0].changedFields).toEqual(
      expect.arrayContaining(['status', 'paidAt', 'paymentMethod', 'paidAmount', 'notes', 'attachmentUrl']),
    );
    expect(JSON.stringify(s.harness.inserted)).not.toMatch(/Maria|bucket/);
  });
});

describe('Lançamentos pelo acompanhamento — auditoria (story 199)', () => {
  function setup() {
    const followUps = memoryRepo();
    const residents = memoryRepo([{ id: 'r1', houseId: 'h1', status: 'ACTIVE', exitDate: null }]);
    const staff = memoryRepo([{ id: 'st1', userId: 'u1' }]);
    const harness = createAuditHarness(
      repoMap([
        [ResidentFollowUp, followUps],
        [Resident, residents],
        [Staff, staff],
      ]),
      houseQuery(),
    );
    const service = new ResidentFollowUpService(
      followUps as never,
      staff as never,
      residents as never,
      {
        upload: jest.fn().mockResolvedValue('https://bucket/comp.pdf'),
        delete: jest.fn(),
        uniqueFilename: jest.fn((n: string) => n),
      } as never,
      harness.audit,
    );
    return { service, harness, followUps };
  }

  it('contribuição avulsa, lote (um evento por mês criado) e comprovante', async () => {
    const s = setup();
    const created = await s.service.create('r1', { date: '2026-09-01', type: 'MONTHLY_CONTRIBUTION' } as never, 'u1');
    await s.service.bulkCreateContributions(
      'r1',
      { months: [{ date: '2026-09-01' }, { date: '2026-07-01' }, { date: '2026-08-01' }] } as never,
      'u1',
    );
    await s.service.uploadAttachment(created.id, 'r1', { originalname: 'c.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf' } as never);

    expect(s.harness.inserted.map((e) => [e.action, e.parentId, e.houseId])).toEqual([
      ['resident.contribution.create', 'r1', 'h1'],
      ['resident.contribution.bulk', 'r1', 'h1'],
      ['resident.contribution.bulk', 'r1', 'h1'],
      ['resident.follow_up.attachment', 'r1', 'h1'],
    ]);
    expect(s.harness.inserted[3].changes).toEqual([
      { field: 'attachmentUrl', before: null, after: '[arquivo]', redacted: false },
    ]);
  });

  it('nota comum não entra no catálogo; alta pelo acompanhamento registra o status', async () => {
    const s = setup();
    await s.service.create('r1', { date: '2026-09-01', type: 'NOTE', description: 'texto clínico' } as never, 'u1');
    expect(s.harness.inserted).toHaveLength(0);
    await s.service.create('r1', { date: '2026-09-02', type: 'DISCHARGE' } as never, 'u1');
    expect(s.harness.inserted).toEqual([
      expect.objectContaining({
        action: 'resident.status.update',
        targetId: 'r1',
        houseId: 'h1',
        changedFields: ['status', 'exitDate'],
      }),
    ]);
    expect(JSON.stringify(s.harness.inserted)).not.toContain('clínico');
  });
});

describe('Produtos recebidos — auditoria (story 199)', () => {
  function setup() {
    const contributions = memoryRepo();
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('house_id FROM residents')) return [{ house_id: 'h1' }];
      if (sql.includes('FROM inventory_items')) {
        return [{ id: 'item-1', kind: 'STOREROOM', unit: 'kg', current_quantity: '3', first_responsible_id: 'st1' }];
      }
      if (sql.includes('INSERT INTO inventory_movements')) return [{ id: 'mv-1' }];
      return [];
    });
    const harness = createAuditHarness(repoMap([[ReceivableProductContribution, contributions]]), query);
    const service = new ReceivableProductContributionService(
      contributions as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'rc1', residentId: 'r1' }) } as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'st1' }) } as never,
      harness.dataSource as never,
      harness.audit,
    );
    return { service, harness, contributions };
  }

  it('declaração em lote: um evento por linha (parcela, filho, casa, produto e quantidade) e remoção', async () => {
    const s = setup();
    await s.service.declare(
      'r1',
      'rc1',
      { lines: [{ inventoryItemId: 'item-1', quantity: 2 }, { description: 'Feijão', quantity: 1, unit: 'kg' }] } as never,
      'u1',
    );
    const [first] = s.harness.inserted;
    expect(s.harness.inserted.map((e) => [e.action, e.parentId, e.houseId])).toEqual([
      ['resident.product_contribution.declare', 'r1', 'h1'],
      ['resident.product_contribution.declare', 'r1', 'h1'],
    ]);
    expect(first.changes).toEqual(
      expect.arrayContaining([
        { field: 'receivableId', before: null, after: 'rc1', redacted: false },
        { field: 'inventoryItemId', before: null, after: 'item-1', redacted: false },
        { field: 'quantity', before: null, after: 2, redacted: false },
      ]),
    );
    // Toda a declaração (linhas, estoque, eventos) numa transação só.
    expect(s.harness.dataSource.transaction).toHaveBeenCalledTimes(1);

    const avulsa = [...s.contributions.table.values()].find((r) => r.description === 'Feijão')!;
    await s.service.remove('r1', 'rc1', avulsa.id as string, 'u1');
    expect(s.harness.inserted[2]).toMatchObject({
      action: 'resident.product_contribution.remove',
      targetId: avulsa.id,
      parentId: 'r1',
    });
  });
});

describe('Vínculos familiares pela ficha — auditoria (story 199)', () => {
  it('familiar criado, marcado responsável e removido: filho como principal, telefone mascarado', async () => {
    const relatives = memoryRepo();
    const harness = createAuditHarness(repoMap([[Relative, relatives]]), houseQuery());
    const service = new RelativeService(
      relatives as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { createAuto: jest.fn() } as never,
      {} as never,
      harness.audit,
    );
    const created = await service.create({ residentId: 'r1', name: 'Mãe', phone: '11988887777' } as never);
    await service.setResponsible(created.id);
    await service.remove(created.id);

    expect(harness.inserted.map((e) => [e.action, e.parentType, e.parentId, e.houseId])).toEqual([
      ['resident.relative.create', 'resident', 'r1', 'h1'],
      ['resident.relative.responsible', 'resident', 'r1', 'h1'],
      ['resident.relative.delete', 'resident', 'r1', 'h1'],
    ]);
    expect(JSON.stringify(harness.inserted)).not.toContain('11988887777');
  });
});
