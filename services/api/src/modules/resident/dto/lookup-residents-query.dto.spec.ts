import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { LookupResidentsQueryDto } from './lookup-residents-query.dto';

// Story 218 — termo da busca de reacolhimento.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

function validate(value: object): Promise<LookupResidentsQueryDto> {
  return pipe.transform(value, { type: 'query', metatype: LookupResidentsQueryDto });
}

describe('LookupResidentsQueryDto', () => {
  it('aceita nome ou CPF com 3+ caracteres e apara espaços', async () => {
    await expect(validate({ q: '  ped  ' })).resolves.toMatchObject({ q: 'ped' });
    await expect(validate({ q: '529.982.247-25' })).resolves.toMatchObject({ q: '529.982.247-25' });
  });

  it.each([{ q: 'ab' }, { q: '   ab   ' }, {}, { q: 'x'.repeat(101) }])(
    'recusa termo curto, ausente ou longo demais (%o) com 400',
    async (value) => {
      await expect(validate(value)).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('mensagem pt-BR para termo curto', async () => {
    const error = await validate({ q: 'ab' }).catch((e: BadRequestException) => e);
    expect(JSON.stringify((error as BadRequestException).getResponse())).toContain(
      'Digite ao menos 3 caracteres para buscar.',
    );
  });

  it('recusa parâmetro extra', async () => {
    await expect(validate({ q: 'pedro', houseId: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
