import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ReceivableProductContributionService } from './receivable-product-contribution.service';
import { ReceivableProductContribution } from './receivable-product-contribution.entity';
import { ResidentReceivable } from './resident-receivable.entity';
import { Staff } from '../staff/staff.entity';

/**
 * Stateful mock do repositório de contribuições: `save` atribui id e guarda a
 * linha; `find`/`softDelete` operam sobre o mesmo store (não deleta fisicamente,
 * só marca `deletedAt`).
 */
function makeStoreRepo() {
  const rows: Record<string, unknown>[] = [];
  let seq = 0;
  return {
    _rows: rows,
    create: jest.fn((v: Record<string, unknown>) => ({ ...v })),
    save: jest.fn(async (v: Record<string, unknown>) => {
      const id = (v.id as string) ?? `c${++seq}`;
      const row = { createdAt: new Date('2026-07-07T00:00:00Z'), createdBy: null, ...v, id };
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows[idx] = row;
      else rows.push(row);
      return row;
    }),
    find: jest.fn(async () => rows.filter((r) => !r.deletedAt)),
    findOne: jest.fn(),
    softDelete: jest.fn(async (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (row) row.deletedAt = new Date();
      return { affected: 1 };
    }),
  };
}

interface TxState {
  item: {
    id: string;
    kind: string;
    unit: string;
    current_quantity: string;
    first_responsible_id: string | null;
  };
  movements: { type: string; quantity: unknown; notes: string; kind: string; responsibleId: unknown }[];
}

function makeDataSource(state: TxState, storeRepo: ReturnType<typeof makeStoreRepo>) {
  const query = jest.fn(async (sql: string, params: unknown[]) => {
    if (/^\s*SELECT/i.test(sql)) return [{ ...state.item }];
    if (/^\s*UPDATE\s+inventory_items/i.test(sql)) {
      state.item.current_quantity = String(params[0]);
      return [];
    }
    if (/INSERT INTO inventory_movements/i.test(sql)) {
      const type = sql.includes("'IN'") ? 'IN' : 'OUT';
      state.movements.push({
        kind: params[0] as string,
        type,
        quantity: params[2],
        responsibleId: params[3],
        notes: params[4] as string,
      });
      return type === 'IN' ? [{ id: `mv${state.movements.length}` }] : [];
    }
    return [];
  });
  const manager = {
    query,
    getRepository: jest.fn(() => storeRepo),
  } as unknown as EntityManager;
  return {
    dataSource: {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
    } as unknown as DataSource,
    query,
  };
}

function makeService(opts: {
  storeRepo: ReturnType<typeof makeStoreRepo>;
  receivable?: Partial<ResidentReceivable> | null;
  staff?: Partial<Staff> | null;
  dataSource: DataSource;
}) {
  const receivableRepo = {
    findOne: jest.fn().mockResolvedValue(opts.receivable === undefined ? { id: 'rcv-1', residentId: 'res-1' } : opts.receivable),
  } as unknown as Repository<ResidentReceivable>;
  const staffRepo = {
    findOne: jest.fn().mockResolvedValue(opts.staff === undefined ? { id: 'staff-9', name: 'Operador' } : opts.staff),
  } as unknown as Repository<Staff>;
  return new ReceivableProductContributionService(
    opts.storeRepo as unknown as Repository<ReceivableProductContribution>,
    receivableRepo,
    staffRepo,
    opts.dataSource,
  );
}

function makeState(): TxState {
  return {
    item: { id: 'item-1', kind: 'STOREROOM', unit: 'kg', current_quantity: '10.000', first_responsible_id: 'staff-1' },
    movements: [],
  };
}

describe('ReceivableProductContributionService.declare', () => {
  it('catalog mode: cria linha E movimento IN vinculado, e o estoque sobe', async () => {
    const storeRepo = makeStoreRepo();
    const state = makeState();
    const { dataSource } = makeDataSource(state, storeRepo);
    const service = makeService({ storeRepo, dataSource });

    const result = await service.declare('res-1', 'rcv-1', {
      lines: [{ inventoryItemId: 'item-1', quantity: 5, unit: 'kg' }],
    }, 'user-1');

    expect(result).toHaveLength(1);
    expect(result[0].inventoryItemId).toBe('item-1');
    expect(result[0].inventoryMovementId).toBe('mv1');
    expect(result[0].pendingDetailing).toBe(false);
    expect(result[0].quantity).toBe(5);
    expect(result[0].unit).toBe('kg');
    // estoque subiu 10 → 15
    expect(state.item.current_quantity).toBe('15');
    // um único movimento IN
    expect(state.movements).toHaveLength(1);
    expect(state.movements[0].type).toBe('IN');
    expect(state.movements[0].quantity).toBe(5);
  });

  it('avulso mode: cria linha pending_detailing SEM movimento de estoque', async () => {
    const storeRepo = makeStoreRepo();
    const state = makeState();
    const { dataSource } = makeDataSource(state, storeRepo);
    const service = makeService({ storeRepo, dataSource });

    const result = await service.declare('res-1', 'rcv-1', {
      lines: [{ description: 'cesta básica', quantity: 2, unit: 'un' }],
    }, 'user-1');

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('cesta básica');
    expect(result[0].inventoryItemId).toBeNull();
    expect(result[0].inventoryMovementId).toBeNull();
    expect(result[0].pendingDetailing).toBe(true);
    expect(state.movements).toHaveLength(0);
    expect(state.item.current_quantity).toBe('10.000');
  });

  it('avulso sem quantidade grava quantity null', async () => {
    const storeRepo = makeStoreRepo();
    const state = makeState();
    const { dataSource } = makeDataSource(state, storeRepo);
    const service = makeService({ storeRepo, dataSource });

    const result = await service.declare('res-1', 'rcv-1', {
      lines: [{ description: 'doações diversas' }],
    }, 'user-1');

    expect(result[0].quantity).toBeNull();
    expect(result[0].unit).toBeNull();
  });

  it('mistura catálogo + avulso na mesma chamada', async () => {
    const storeRepo = makeStoreRepo();
    const state = makeState();
    const { dataSource } = makeDataSource(state, storeRepo);
    const service = makeService({ storeRepo, dataSource });

    const result = await service.declare('res-1', 'rcv-1', {
      lines: [
        { inventoryItemId: 'item-1', quantity: 3, unit: 'kg' },
        { description: 'roupas usadas' },
      ],
    }, 'user-1');

    expect(result).toHaveLength(2);
    expect(state.movements).toHaveLength(1);
  });

  it('item XOR descrição: barra linha com ambos', async () => {
    const storeRepo = makeStoreRepo();
    const { dataSource } = makeDataSource(makeState(), storeRepo);
    const service = makeService({ storeRepo, dataSource });

    await expect(
      service.declare('res-1', 'rcv-1', {
        lines: [{ inventoryItemId: 'item-1', description: 'x', quantity: 1 }],
      }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('item XOR descrição: barra linha sem nenhum dos dois', async () => {
    const storeRepo = makeStoreRepo();
    const { dataSource } = makeDataSource(makeState(), storeRepo);
    const service = makeService({ storeRepo, dataSource });

    await expect(
      service.declare('res-1', 'rcv-1', { lines: [{ quantity: 1 }] }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('catálogo com quantidade <= 0 é barrado', async () => {
    const storeRepo = makeStoreRepo();
    const { dataSource } = makeDataSource(makeState(), storeRepo);
    const service = makeService({ storeRepo, dataSource });

    await expect(
      service.declare('res-1', 'rcv-1', { lines: [{ inventoryItemId: 'item-1', quantity: 0 }] }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('catálogo sem staff responsável é barrado', async () => {
    const storeRepo = makeStoreRepo();
    const { dataSource } = makeDataSource(makeState(), storeRepo);
    const service = makeService({ storeRepo, dataSource, staff: null });

    await expect(
      service.declare('res-1', 'rcv-1', { lines: [{ inventoryItemId: 'item-1', quantity: 1 }] }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('parcela inexistente → NotFound', async () => {
    const storeRepo = makeStoreRepo();
    const { dataSource } = makeDataSource(makeState(), storeRepo);
    const service = makeService({ storeRepo, dataSource, receivable: null });

    await expect(
      service.declare('res-1', 'rcv-x', { lines: [{ description: 'x' }] }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('item de catálogo inexistente → NotFound', async () => {
    const storeRepo = makeStoreRepo();
    const state = makeState();
    const { dataSource, query } = makeDataSource(state, storeRepo);
    query.mockImplementation(async (sql: string) => {
      if (/^\s*SELECT/i.test(sql)) return [];
      return [];
    });
    const service = makeService({ storeRepo, dataSource });

    await expect(
      service.declare('res-1', 'rcv-1', { lines: [{ inventoryItemId: 'ghost', quantity: 1 }] }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ReceivableProductContributionService.remove', () => {
  it('catálogo: gera correção OUT sem apagar o IN e faz soft delete da linha', async () => {
    const storeRepo = makeStoreRepo();
    const state = makeState();
    const { dataSource } = makeDataSource(state, storeRepo);
    const service = makeService({ storeRepo, dataSource });

    // declara catálogo primeiro (estoque 10 → 15)
    const [created] = await service.declare('res-1', 'rcv-1', {
      lines: [{ inventoryItemId: 'item-1', quantity: 5, unit: 'kg' }],
    }, 'user-1');
    expect(state.movements).toHaveLength(1);

    storeRepo.findOne.mockResolvedValue({
      id: created.id,
      receivableId: 'rcv-1',
      inventoryItemId: 'item-1',
      quantity: 5,
    });

    await service.remove('res-1', 'rcv-1', created.id, 'user-1');

    // um IN + um OUT de correção, nenhum DELETE físico do IN
    const ins = state.movements.filter((m) => m.type === 'IN');
    const outs = state.movements.filter((m) => m.type === 'OUT');
    expect(ins).toHaveLength(1);
    expect(outs).toHaveLength(1);
    expect(outs[0].quantity).toBe(5);
    // estoque volta 15 → 10
    expect(state.item.current_quantity).toBe('10');
    expect(storeRepo.softDelete).toHaveBeenCalledWith(created.id);
  });

  it('avulso: apenas soft delete, sem movimento', async () => {
    const storeRepo = makeStoreRepo();
    const state = makeState();
    const { dataSource } = makeDataSource(state, storeRepo);
    const service = makeService({ storeRepo, dataSource });

    storeRepo.findOne.mockResolvedValue({
      id: 'c-avulso',
      receivableId: 'rcv-1',
      inventoryItemId: null,
      quantity: null,
    });

    await service.remove('res-1', 'rcv-1', 'c-avulso', 'user-1');

    expect(state.movements).toHaveLength(0);
    expect(storeRepo.softDelete).toHaveBeenCalledWith('c-avulso');
  });

  it('parcela inexistente → NotFound', async () => {
    const storeRepo = makeStoreRepo();
    const { dataSource } = makeDataSource(makeState(), storeRepo);
    const service = makeService({ storeRepo, dataSource, receivable: null });

    await expect(service.remove('res-1', 'rcv-x', 'c1', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('contribuição inexistente → NotFound', async () => {
    const storeRepo = makeStoreRepo();
    const { dataSource } = makeDataSource(makeState(), storeRepo);
    storeRepo.findOne.mockResolvedValue(null);
    const service = makeService({ storeRepo, dataSource });

    await expect(service.remove('res-1', 'rcv-1', 'ghost', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ReceivableProductContributionService.listByReceivable / mapByReceivables', () => {
  it('lista as contribuições da parcela', async () => {
    const storeRepo = makeStoreRepo();
    const state = makeState();
    const { dataSource } = makeDataSource(state, storeRepo);
    const service = makeService({ storeRepo, dataSource });

    await service.declare('res-1', 'rcv-1', {
      lines: [{ description: 'cesta' }],
    }, 'user-1');

    const list = await service.listByReceivable('res-1', 'rcv-1');
    expect(list).toHaveLength(1);
    expect(list[0].description).toBe('cesta');
  });

  it('listByReceivable com parcela inexistente → NotFound', async () => {
    const storeRepo = makeStoreRepo();
    const { dataSource } = makeDataSource(makeState(), storeRepo);
    const service = makeService({ storeRepo, dataSource, receivable: null });

    await expect(service.listByReceivable('res-1', 'rcv-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mapByReceivables com lista vazia devolve mapa vazio', async () => {
    const storeRepo = makeStoreRepo();
    const { dataSource } = makeDataSource(makeState(), storeRepo);
    const service = makeService({ storeRepo, dataSource });

    const map = await service.mapByReceivables([]);
    expect(map.size).toBe(0);
  });

  it('mapByReceivables agrupa por parcela', async () => {
    const storeRepo = makeStoreRepo();
    const state = makeState();
    const { dataSource } = makeDataSource(state, storeRepo);
    const service = makeService({ storeRepo, dataSource });

    await service.declare('res-1', 'rcv-1', {
      lines: [{ description: 'a' }, { description: 'b' }],
    }, 'user-1');

    const map = await service.mapByReceivables(['rcv-1']);
    expect(map.get('rcv-1')).toHaveLength(2);
  });
});
