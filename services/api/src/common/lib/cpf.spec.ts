import { ValidationPipe } from '@nestjs/common';
import { formatCpf, INVALID_CPF_MESSAGE, isValidCpf, maskCpfInput, normalizeCpf } from '@fonte/types';
import { CreateResidentDto } from '../../modules/resident/dto/create-resident.dto';
import { UpdateResidentDto } from '../../modules/resident/dto/update-resident.dto';
import { UpdateResidentIdentityDto } from '../../modules/resident/dto/update-resident-identity.dto';
import { IsCpfConstraint } from './cpf';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const HOUSE_ID = '22222222-2222-4222-8222-222222222222';
const VALID = '52998224725';

function validate<T>(metatype: new () => T, value: object): Promise<T> {
  return pipe.transform(value, { type: 'body', metatype }) as Promise<T>;
}

async function messagesOf(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
    return [];
  } catch (error) {
    return (error as { getResponse(): { message: string[] } }).getResponse().message;
  }
}

describe('helpers de CPF de @fonte/types (story 219)', () => {
  it('normalizeCpf: só dígitos; vazio/só máscara → null', () => {
    expect(normalizeCpf('529.982.247-25')).toBe(VALID);
    expect(normalizeCpf(' 52998224725 ')).toBe(VALID);
    expect(normalizeCpf('')).toBeNull();
    expect(normalizeCpf('..-')).toBeNull();
    expect(normalizeCpf(null)).toBeNull();
    expect(normalizeCpf(undefined)).toBeNull();
  });

  it('isValidCpf: DV correto, com ou sem máscara', () => {
    expect(isValidCpf(VALID)).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
    // DV que dá resto 10 → 0 (cobre o ramo).
    expect(isValidCpf('12345678909')).toBe(true);
  });

  it.each([
    ['DV errado', '52998224724'],
    ['primeiro DV errado', '52998224735'],
    ['repetido 111…', '11111111111'],
    ['repetido 000…', '00000000000'],
    ['curto', '5299822472'],
    ['longo', '529982247250'],
    ['vazio', ''],
    ['null', null],
  ])('isValidCpf rejeita %s', (_label, value) => {
    expect(isValidCpf(value as string | null)).toBe(false);
  });

  it('formatCpf: 11 dígitos → máscara; fora disso devolve como veio', () => {
    expect(formatCpf(VALID)).toBe('529.982.247-25');
    expect(formatCpf('529.982.247-25')).toBe('529.982.247-25');
    expect(formatCpf('123')).toBe('123');
    expect(formatCpf('')).toBe('');
  });

  it('maskCpfInput: máscara progressiva na digitação', () => {
    expect(maskCpfInput('')).toBe('');
    expect(maskCpfInput('52')).toBe('52');
    expect(maskCpfInput('5299')).toBe('529.9');
    expect(maskCpfInput('5299822')).toBe('529.982.2');
    expect(maskCpfInput('5299822472')).toBe('529.982.247-2');
    expect(maskCpfInput('529.982.247-25999')).toBe('529.982.247-25');
  });
});

describe('validator IsCpf / NormalizeCpf nos DTOs (story 219)', () => {
  it('create: aceita CPF mascarado e entrega só dígitos', async () => {
    const dto = await validate(CreateResidentDto, { name: 'A', houseId: HOUSE_ID, cpf: '529.982.247-25' });
    expect(dto.cpf).toBe(VALID);
  });

  it('create: CPF com DV inválido → 400 "CPF inválido."', async () => {
    const messages = await messagesOf(validate(CreateResidentDto, { name: 'A', houseId: HOUSE_ID, cpf: '123.456.789-00' }));
    expect(messages).toContain(INVALID_CPF_MESSAGE);
  });

  it('create: vazio vira null e passa; ausente segue ausente', async () => {
    const empty = await validate(CreateResidentDto, { name: 'A', houseId: HOUSE_ID, cpf: '' });
    expect(empty.cpf).toBeNull();
    const absent = await validate(CreateResidentDto, { name: 'A', houseId: HOUSE_ID });
    expect(absent.cpf).toBeUndefined();
  });

  it('create: valor que não é string é recusado', async () => {
    const messages = await messagesOf(validate(CreateResidentDto, { name: 'A', houseId: HOUSE_ID, cpf: 52998224725 }));
    expect(messages).toContain(INVALID_CPF_MESSAGE);
  });

  it('update/identidade: só normaliza — DV fica para o service (ficha legada)', async () => {
    const update = await validate(UpdateResidentDto, { cpf: '123.45' });
    expect(update.cpf).toBe('12345');
    const identity = await validate(UpdateResidentIdentityDto, { cpf: '529.982.247-25' });
    expect(identity.cpf).toBe(VALID);
  });

  it('IsCpfConstraint expõe a mensagem padrão', () => {
    expect(new IsCpfConstraint().defaultMessage()).toBe(INVALID_CPF_MESSAGE);
  });
});
