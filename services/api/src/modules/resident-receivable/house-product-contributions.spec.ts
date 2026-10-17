import { validate } from 'class-validator';
import { NotFoundException } from '@nestjs/common';
import { ReceivableProductContributionService } from './receivable-product-contribution.service';
import { GetHouseProductContributionsDto } from '../house/dto/get-house-product-contributions.dto';

describe('House product contributions', () => {
  const rows = [
    { id: '1', receivableId: 'rz', receivable: { resident: { id: 'z', name: 'Zé' } }, createdAt: new Date('2026-09-01T00:00:00Z'), quantity: '2' },
    { id: '2', receivableId: 'ra', receivable: { resident: { id: 'a', name: 'Álvaro' } }, createdAt: new Date('2026-09-02T00:00:00Z'), quantity: null },
    { id: '3', receivableId: 'rz', receivable: { resident: { id: 'z', name: 'Zé' } }, createdAt: new Date('2026-09-03T00:00:00Z'), quantity: '3' },
  ];
  const query = { innerJoinAndSelect: jest.fn(), leftJoinAndSelect: jest.fn(), where: jest.fn(), andWhere: jest.fn(), orderBy: jest.fn(), getMany: jest.fn() };
  const existsBy = jest.fn();
  let service: ReceivableProductContributionService;
  beforeEach(() => {
    Object.values(query).forEach((fn) => fn.mockReset().mockReturnValue(query));
    query.getMany.mockResolvedValue(rows);
    existsBy.mockResolvedValue(true);
    service = new ReceivableProductContributionService({ createQueryBuilder: () => query } as never, {} as never, {} as never,
      { getRepository: () => ({ existsBy }) } as never, {} as never);
  });
  it('groups ordered lines, sorts names in pt-BR and never exposes money', async () => {
    const result = await service.listByHouseAndMonth('h1', '2026-09-01');
    expect(result.map((r) => r.residentName)).toEqual(['Álvaro', 'Zé']);
    expect(result[1].lines.map((r) => r.id)).toEqual(['1', '3']);
    expect(Object.keys(result[1]).sort()).toEqual(['lines', 'receivableId', 'referenceMonth', 'residentId', 'residentName']);
    expect(Object.keys(result[1].lines[0]).sort()).toEqual(['createdAt', 'createdByName', 'description', 'id', 'inventoryItemId', 'inventoryMovementId', 'pendingDetailing', 'quantity', 'receivableId', 'unit']);
    expect(query.where).toHaveBeenCalledWith('resident.house_id = :houseId', { houseId: 'h1' });
    expect(query.andWhere).toHaveBeenCalledWith('receivable.reference_month = :month', { month: '2026-09-01' });
    expect(query.innerJoinAndSelect).toHaveBeenCalledWith('contribution.receivable', 'receivable', 'receivable.deleted_at IS NULL');
    expect(query.andWhere).toHaveBeenCalledWith('contribution.deleted_at IS NULL');
    expect(query.orderBy).toHaveBeenCalledWith('contribution.created_at', 'ASC');
  });
  it('uses string components for first-day dates, independent of negative timezone', async () => {
    const prior = process.env.TZ;
    process.env.TZ = 'America/Sao_Paulo';
    try { expect((await service.listByHouseAndMonth('h', '2026-03-01'))[0].referenceMonth).toBe('2026-03-01'); }
    finally { if (prior === undefined) delete process.env.TZ; else process.env.TZ = prior; }
  });
  it('defaults to current local month; an empty house has no placeholder groups', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 20));
    try {
      query.getMany.mockResolvedValue([]);
      expect(await service.listByHouseAndMonth('h')).toEqual([]);
      expect(query.andWhere).toHaveBeenCalledWith('receivable.reference_month = :month', { month: '2026-09-01' });
    } finally { jest.useRealTimers(); }
  });
  it('returns 404 for unknown house', async () => {
    existsBy.mockResolvedValue(false);
    await expect(service.listByHouseAndMonth('missing')).rejects.toThrow(NotFoundException);
  });
  it.each(['2026-13-01', '2026-02-30', '2026-09', '2026-09-01T00:00:00Z', 'x'])('rejects invalid date %s', async (referenceMonth) => {
    expect(await validate(Object.assign(new GetHouseProductContributionsDto(), { referenceMonth }))).not.toHaveLength(0);
  });
  it.each([undefined, '2026-09-01'])('accepts optional date %s', async (referenceMonth) => {
    expect(await validate(Object.assign(new GetHouseProductContributionsDto(), { referenceMonth }))).toHaveLength(0);
  });
});
