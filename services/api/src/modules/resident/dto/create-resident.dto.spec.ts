import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResidentStatus } from '@fonte/types';
import { CreateResidentDto } from './create-resident.dto';

/** Casa opcional para qualquer status; quando presente, valida o formato UUID. */
describe('CreateResidentDto — houseId opcional', () => {
  const HOUSE = '550e8400-e29b-41d4-a716-446655440000';

  async function errorsOf(payload: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(CreateResidentDto, { name: 'João', ...payload });
    const errors = await validate(dto);
    return errors.map((e) => e.property);
  }

  it('aceita houseId ausente ou null em qualquer status', async () => {
    expect(await errorsOf({})).not.toContain('houseId');
    expect(await errorsOf({ status: ResidentStatus.ACTIVE })).not.toContain('houseId');
    expect(await errorsOf({ status: ResidentStatus.ACTIVE, houseId: null })).not.toContain(
      'houseId',
    );
    expect(await errorsOf({ status: ResidentStatus.ARCHIVED })).not.toContain('houseId');
  });

  it('houseId presente ainda valida o formato UUID', async () => {
    expect(await errorsOf({ houseId: 'não-uuid' })).toContain('houseId');
    expect(await errorsOf({ houseId: HOUSE })).not.toContain('houseId');
  });
});
