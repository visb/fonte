jest.mock('@fonte/types', () => ({
  ResidentStatus: {
    PRE_ADMISSION: 'PRE_ADMISSION',
    ACTIVE: 'ACTIVE',
    DISCIPLINE: 'DISCIPLINE',
    TEMP_LEAVE: 'TEMP_LEAVE',
    DISCHARGED: 'DISCHARGED',
    EVADED: 'EVADED',
  },
  Role: {
    ADMIN: 'ADMIN',
    COORDINATOR: 'COORDINATOR',
    OPERATOR: 'OPERATOR',
    RELATIVE: 'RELATIVE',
    RESIDENT: 'RESIDENT',
  },
}));

import { ResidentStatus } from '@fonte/types';
import { Repository } from 'typeorm';
import { ResidentService } from './resident.service';
import { Resident } from './resident.entity';
import { ResidentDocument } from './resident-document.entity';
import { ResidentAttachment } from './resident-attachment.entity';
import { User } from '../user/user.entity';
import { ListResidentsDto } from './dto/list-residents.dto';

function makeQb(data: Resident[], total: number) {
  const qb: Record<string, jest.Mock> = {};
  const chain = (name: string) => {
    qb[name] = jest.fn().mockReturnValue(qb);
    return qb;
  };
  ['leftJoinAndSelect', 'orderBy', 'skip', 'take', 'andWhere'].forEach(chain);
  qb.getManyAndCount = jest.fn().mockResolvedValue([data, total]);
  return qb;
}

describe('ResidentService.findAll', () => {
  let service: ResidentService;
  let qb: ReturnType<typeof makeQb>;

  const mockResident = (name: string, status = ResidentStatus.ACTIVE) =>
    ({ id: 'r1', name, status } as unknown as Resident);

  beforeEach(() => {
    qb = makeQb([], 0);
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as unknown as Repository<Resident>;

    service = new ResidentService(
      repo,
      {} as Repository<ResidentDocument>,
      {} as Repository<ResidentAttachment>,
      {} as Repository<User>,
      {} as never,
    );
  });

  it('returns paginated residents with default page/limit', async () => {
    const residents = [mockResident('Ana')];
    qb.getManyAndCount.mockResolvedValue([residents, 1]);

    const dto: ListResidentsDto = {};
    const result = await service.findAll(dto);

    expect(result).toEqual({ data: residents, total: 1, page: 1, limit: 20 });
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(20);
  });

  it('applies correct skip for page > 1', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 50]);

    const dto: ListResidentsDto = { page: 3, limit: 10 };
    const result = await service.findAll(dto);

    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  it('applies LIKE filter when search is provided', async () => {
    const dto: ListResidentsDto = { search: 'joao' };
    await service.findAll(dto);

    expect(qb.andWhere).toHaveBeenCalledWith(
      'LOWER(resident.name) LIKE LOWER(:search)',
      { search: '%joao%' },
    );
  });

  it('does not apply LIKE filter when search is absent', async () => {
    const dto: ListResidentsDto = {};
    await service.findAll(dto);

    const whereCalls: string[] = (qb.andWhere as jest.Mock).mock.calls.map((c) => c[0]);
    expect(whereCalls.some((c) => c.includes('resident.name'))).toBe(false);
  });

  it('applies status filter when status is provided', async () => {
    const dto: ListResidentsDto = { status: ResidentStatus.ACTIVE };
    await service.findAll(dto);

    expect(qb.andWhere).toHaveBeenCalledWith('resident.status = :status', {
      status: ResidentStatus.ACTIVE,
    });
  });

  it('does not apply status filter when status is absent', async () => {
    const dto: ListResidentsDto = {};
    await service.findAll(dto);

    const whereCalls: string[] = (qb.andWhere as jest.Mock).mock.calls.map((c) => c[0]);
    expect(whereCalls.some((c) => c.includes('resident.status'))).toBe(false);
  });

  it('applies both search and status filters together', async () => {
    const dto: ListResidentsDto = { search: 'Maria', status: ResidentStatus.DISCIPLINE };
    await service.findAll(dto);

    expect(qb.andWhere).toHaveBeenCalledWith(
      'LOWER(resident.name) LIKE LOWER(:search)',
      { search: '%Maria%' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('resident.status = :status', {
      status: ResidentStatus.DISCIPLINE,
    });
  });

  it('returns correct total from getManyAndCount', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 42]);
    const result = await service.findAll({});
    expect(result.total).toBe(42);
  });
});
