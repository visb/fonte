import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListStaffQueryDto } from './list-staff-query.dto';

async function errorsFor(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListStaffQueryDto, plain);
  const errors = await validate(dto);
  return { dto, props: errors.map((e) => e.property) };
}

describe('ListStaffQueryDto (stories 217/223)', () => {
  it('aceita query vazia', async () => {
    expect((await errorsFor({})).props).toEqual([]);
  });

  it('aceita status, search e houseId válidos e apara a busca', async () => {
    const { dto, props } = await errorsFor({
      status: 'dismissed',
      search: '  João  ',
      houseId: '7d1c0c1e-3b8a-4c43-9d8e-2a4f1f1b9c10',
    });
    expect(props).toEqual([]);
    expect(dto.search).toBe('João');
  });

  it('status fora da lista → erro', async () => {
    expect((await errorsFor({ status: 'all' })).props).toEqual(['status']);
  });

  it('houseId não-UUID → erro', async () => {
    expect((await errorsFor({ houseId: 'abc' })).props).toEqual(['houseId']);
  });

  it('search com mais de 100 caracteres → erro', async () => {
    expect((await errorsFor({ search: 'a'.repeat(101) })).props).toEqual(['search']);
    expect((await errorsFor({ search: 'a'.repeat(100) })).props).toEqual([]);
  });

  it('search não-string → erro', async () => {
    expect((await errorsFor({ search: 42 })).props).toEqual(['search']);
  });
});
