import { describe, expect, it } from 'vitest';
import { MaritalStatus } from '@fonte/types';
import { extractTemplateVars, extractTemplatesVars, findMissingFields, slugify } from './documentFields';
import type { Resident } from '@fonte/api-client';

function resident(over: Partial<Resident> = {}): Resident {
  return { id: 'r1', name: 'Fulano', ...over } as Resident;
}

describe('slugify', () => {
  it('remove acentos, pontuação e espaços', () => {
    expect(slugify('João Silva Termo de Adesão')).toBe('joao-silva-termo-de-adesao');
  });

  it('não deixa hífen sobrando nas pontas', () => {
    expect(slugify('  Termo!  ')).toBe('termo');
  });
});

describe('extractTemplateVars', () => {
  it('devolve as variáveis do conteúdo sem repetição', () => {
    expect(extractTemplateVars('{{name}} e {{cpf}} e de novo {{name}}')).toEqual(['name', 'cpf']);
  });

  it('devolve lista vazia sem variáveis', () => {
    expect(extractTemplateVars('texto puro')).toEqual([]);
  });
});

describe('extractTemplatesVars', () => {
  it('une as variáveis de vários templates deduplicando (story 152)', () => {
    expect(
      extractTemplatesVars([{ content: '{{name}} {{cpf}}' }, { content: '{{cpf}} {{rg}}' }]),
    ).toEqual(['name', 'cpf', 'rg']);
  });
});

describe('findMissingFields', () => {
  it('ignora variáveis sempre disponíveis e desconhecidas', () => {
    const missing = findMissingFields(['name', 'date', 'signature', 'inexistente'], resident());
    expect(missing).toEqual([]);
  });

  it('lista só os campos realmente vazios', () => {
    const missing = findMissingFields(['cpf', 'rg'], resident({ cpf: '123' }));
    expect(missing.map((f) => f.residentField)).toEqual(['rg']);
  });

  it('deduplica por campo do filho ({{age}} e {{birthDate}} são o mesmo dado)', () => {
    const missing = findMissingFields(['age', 'birthDate'], resident());
    expect(missing).toHaveLength(1);
    expect(missing[0].label).toBe('Data de nascimento');
    expect(missing[0].inputType).toBe('date');
  });

  // Story 157 — filho SEM foto não vira pergunta: a ausência de foto imprime a
  // moldura vazia, então o MissingFieldsDialog nunca deve abrir por causa dela
  // (nem sozinha, nem junto de campos que faltam de verdade).
  it('residentPhoto nunca vira campo faltante, mesmo sem foto (story 157)', () => {
    const semFoto = resident({ photoUrl: null } as Partial<Resident>);
    expect(findMissingFields(['residentPhoto'], semFoto)).toEqual([]);
    expect(findMissingFields(['residentPhoto', 'cpf'], semFoto).map((f) => f.residentField)).toEqual([
      'cpf',
    ]);
  });

  // Story 159 — filho ATIVO não tem data de saída, e isso é o caso normal: o
  // documento imprime "não informado". Se a variável virasse pergunta, o
  // MissingFieldsDialog abriria em todo documento que a usasse.
  it('exitDate nunca vira campo faltante, mesmo sem saída (story 159)', () => {
    const semSaida = resident({ exitDate: null } as Partial<Resident>);
    expect(findMissingFields(['exitDate'], semSaida)).toEqual([]);
    expect(findMissingFields(['entryDate', 'exitDate'], semSaida)).toEqual([]);
    expect(findMissingFields(['exitDate', 'cpf'], semSaida).map((f) => f.residentField)).toEqual([
      'cpf',
    ]);
  });

  it('estado civil vem com as opções do select', () => {
    const missing = findMissingFields(['maritalStatus'], resident());
    expect(missing[0].options?.map((o) => o.value)).toEqual([
      MaritalStatus.SINGLE, MaritalStatus.MARRIED, MaritalStatus.STABLE_UNION,
      MaritalStatus.DIVORCED, MaritalStatus.WIDOWED,
    ]);
    expect(missing[0].options?.map((o) => o.label)).toEqual([
      'Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)',
    ]);
  });

  it('cobre o mapa completo de variáveis do filho', () => {
    const vars = ['cpf', 'rg', 'nationality', 'city', 'state', 'birthDate', 'maritalStatus', 'address', 'phone'];
    expect(findMissingFields(vars, resident()).map((f) => f.residentField)).toEqual([
      'cpf', 'rg', 'nationality', 'city', 'state', 'birthDate', 'maritalStatus', 'address', 'contactPhone',
    ]);
    const filled = resident({
      cpf: '1', rg: '2', nationality: 'BR', city: 'SP', state: 'SP',
      birthDate: '2000-01-01', maritalStatus: MaritalStatus.SINGLE, address: 'Rua 1', contactPhone: '119',
    });
    expect(findMissingFields(vars, filled)).toEqual([]);
  });

  it('campo preenchido não vira pergunta', () => {
    expect(findMissingFields(['maritalStatus'], resident({ maritalStatus: MaritalStatus.SINGLE }))).toEqual([]);
  });
});
