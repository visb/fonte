import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResidentStatus } from '@fonte/types';
import { CreateResidentDto } from './create-resident.dto';

/** Regra condicional da casa: obrigatória para todo status exceto ARCHIVED. */
describe('CreateResidentDto — houseId condicional', () => {
  const HOUSE = '550e8400-e29b-41d4-a716-446655440000';

  async function errorsOf(payload: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(CreateResidentDto, { name: 'João', ...payload });
    const errors = await validate(dto);
    return errors.map((e) => e.property);
  }

  it('exige houseId quando o status não é ARCHIVED', async () => {
    expect(await errorsOf({ status: ResidentStatus.ACTIVE })).toContain('houseId');
    expect(await errorsOf({})).toContain('houseId'); // status ausente também exige
    expect(await errorsOf({ status: ResidentStatus.ACTIVE, houseId: null })).toContain('houseId');
  });

  it('dispensa houseId quando ARCHIVED (ausente ou null)', async () => {
    expect(await errorsOf({ status: ResidentStatus.ARCHIVED })).not.toContain('houseId');
    expect(await errorsOf({ status: ResidentStatus.ARCHIVED, houseId: null })).not.toContain(
      'houseId',
    );
  });

  it('ARCHIVED com houseId presente ainda valida o formato UUID', async () => {
    expect(await errorsOf({ status: ResidentStatus.ARCHIVED, houseId: 'não-uuid' })).toContain(
      'houseId',
    );
    expect(await errorsOf({ status: ResidentStatus.ARCHIVED, houseId: HOUSE })).not.toContain(
      'houseId',
    );
  });

  it('status normal com houseId UUID válido passa', async () => {
    expect(await errorsOf({ status: ResidentStatus.ACTIVE, houseId: HOUSE })).not.toContain(
      'houseId',
    );
  });
});
