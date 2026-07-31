import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GenerateCombinedPdfDto } from './generate-combined-pdf.dto';

// Story 152 — o corpo do POST do PDF combinado só aceita uma lista NÃO VAZIA de
// uuids v4; qualquer outra coisa é 400 antes de abrir o browser.
describe('GenerateCombinedPdfDto', () => {
  const A = '550e8400-e29b-41d4-a716-446655440000';
  const B = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  async function errorsOf(payload: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(GenerateCombinedPdfDto, payload);
    const errors = await validate(dto);
    return errors.map((e) => e.property);
  }

  it('aceita uma lista de uuids v4', async () => {
    expect(await errorsOf({ templateIds: [A, B] })).toEqual([]);
  });

  it('rejeita lista vazia', async () => {
    expect(await errorsOf({ templateIds: [] })).toContain('templateIds');
  });

  it('rejeita campo ausente ou não-array', async () => {
    expect(await errorsOf({})).toContain('templateIds');
    expect(await errorsOf({ templateIds: A })).toContain('templateIds');
  });

  it('rejeita qualquer id que não seja uuid v4', async () => {
    expect(await errorsOf({ templateIds: [A, 'nao-uuid'] })).toContain('templateIds');
  });
});
