import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { DailyController } from './daily.controller';
import { DailyService } from './daily.service';
import { MoveDailyPersonDto } from './dto/move-daily-person.dto';
import { DailyHouseDto } from './dto/daily-house.dto';

const user = { userId: 'u1', role: 'COORDINATOR', profileType: 'STAFF' };
const UUID = '4a3f2c1e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';

describe('DailyController', () => {
  const service = {
    current: jest.fn().mockResolvedValue('board'),
    start: jest.fn().mockResolvedValue('board2'),
    move: jest.fn().mockResolvedValue({ version: 1 }),
    apply: jest.fn().mockResolvedValue({ applied: 0, skipped: [] }),
  };
  const controller = new DailyController(service as unknown as DailyService);

  it('só ADMIN e COORDINATOR (decisão 3)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, DailyController)).toEqual(['ADMIN', 'COORDINATOR']);
  });

  it('roteia para o service com o usuário autenticado', async () => {
    await expect(controller.current({ houseId: 'h1' }, user)).resolves.toBe('board');
    expect(service.current).toHaveBeenCalledWith(user, 'h1');
    await expect(controller.start({}, user)).resolves.toBe('board2');
    expect(service.start).toHaveBeenCalledWith(user, undefined);
    const dto = { personType: 'RESIDENT', personId: UUID, toMinistryId: null } as MoveDailyPersonDto;
    await controller.move('s1', dto, user);
    expect(service.move).toHaveBeenCalledWith(user, 's1', dto);
    await controller.apply('s1', user);
    expect(service.apply).toHaveBeenCalledWith(user, 's1');
  });
});

describe('MoveDailyPersonDto', () => {
  const check = (body: object) => validate(plainToInstance(MoveDailyPersonDto, body));

  it('aceita destino UUID ou null', async () => {
    expect(await check({ personType: 'STAFF', personId: UUID, toMinistryId: UUID })).toHaveLength(0);
    expect(await check({ personType: 'RESIDENT', personId: UUID, toMinistryId: null })).toHaveLength(0);
  });

  it('rejeita tipo inválido, personId não-UUID e destino ausente/inválido', async () => {
    const errors = await check({ personType: 'X', personId: 'y', toMinistryId: 'z' });
    expect(errors.map((e) => e.property).sort()).toEqual(['personId', 'personType', 'toMinistryId']);
    expect((await check({ personType: 'STAFF', personId: UUID })).map((e) => e.property)).toEqual(['toMinistryId']);
  });
});

describe('DailyHouseDto', () => {
  it('houseId opcional, mas UUID quando presente', async () => {
    expect(await validate(plainToInstance(DailyHouseDto, {}))).toHaveLength(0);
    expect(await validate(plainToInstance(DailyHouseDto, { houseId: 'x' }))).toHaveLength(1);
  });
});
