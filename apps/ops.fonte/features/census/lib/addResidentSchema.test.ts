import { ADMISSION_DATE_MESSAGES, Gender, INVALID_CPF_MESSAGE } from '@fonte/types';
import {
  ADD_RESIDENT_DATE_MESSAGES,
  addResidentSchema,
  buildAddResidentDefaults,
} from './addResidentSchema';

// Relógio fixo: 2026-10-17 12:00 em São Paulo.
beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-17T15:00:00Z') }));
afterEach(() => jest.useRealTimers());

function issues(overrides: Record<string, unknown>) {
  const result = addResidentSchema.safeParse({
    ...buildAddResidentDefaults(),
    name: 'Filho',
    ...overrides,
  });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
}

describe('addResidentSchema — CPF (story 219)', () => {
  it('vazio e CPF válido (com ou sem máscara) passam', () => {
    expect(issues({ cpf: '' })).toEqual({});
    expect(issues({ cpf: '529.982.247-25' })).toEqual({});
    expect(issues({ cpf: '52998224725' })).toEqual({});
  });

  it.each([
    ['DV errado', '123.456.789-00'],
    ['repetido', '111.111.111-11'],
    ['curto', '529.982.247'],
  ])('rejeita %s com "CPF inválido."', (_label, cpf) => {
    expect(issues({ cpf }).cpf).toBe(INVALID_CPF_MESSAGE);
  });
});

describe('addResidentSchema (stories 202, 203 e 209)', () => {
  it('defaults: acolhimento hoje (fuso da operação), sem nascimento, aceito', () => {
    const defaults = buildAddResidentDefaults();
    expect(defaults.entryDate).toBe('2026-10-17');
    expect(defaults.gender).toBe(Gender.MALE);
    expect(issues({})).toEqual({});
  });

  it('acolhimento vazio (texto incompleto) é obrigatório', () => {
    expect(issues({ entryDate: '' }).entryDate).toBe(ADD_RESIDENT_DATE_MESSAGES.entryRequired);
  });

  it('acolhimento digitado errado mostra "data inválida"', () => {
    expect(issues({ entryDate: '', entryDateInvalid: true }).entryDate).toBe(
      ADD_RESIDENT_DATE_MESSAGES.invalid,
    );
  });

  it('acolhimento futuro é recusado', () => {
    expect(issues({ entryDate: '2026-10-18' }).entryDate).toBe(ADMISSION_DATE_MESSAGES.entryFuture);
  });

  it('nascimento é opcional', () => {
    expect(issues({ birthDate: '' })).toEqual({});
    expect(issues({ birthDate: undefined })).toEqual({});
  });

  it('nascimento digitado errado (opcional) não passa como "não informado"', () => {
    expect(issues({ birthDate: '', birthDateInvalid: true }).birthDate).toBe(
      ADD_RESIDENT_DATE_MESSAGES.invalid,
    );
  });

  it('nascimento futuro é recusado', () => {
    expect(issues({ birthDate: '2026-12-01' }).birthDate).toBe(ADD_RESIDENT_DATE_MESSAGES.birthFuture);
  });

  it('nascimento depois do acolhimento é recusado', () => {
    expect(issues({ entryDate: '2026-01-10', birthDate: '2026-02-01' }).birthDate).toBe(
      ADD_RESIDENT_DATE_MESSAGES.birthAfterEntry,
    );
  });

  describe('maioridade na data de acolhimento', () => {
    it('véspera do 18º aniversário (17 anos e 364 dias) → recusado', () => {
      expect(issues({ entryDate: '2026-10-17', birthDate: '2008-10-18' }).birthDate).toBe(
        ADD_RESIDENT_DATE_MESSAGES.adultAtEntry,
      );
    });

    it('18 anos exatos no dia do acolhimento → aceito', () => {
      expect(issues({ entryDate: '2026-10-17', birthDate: '2008-10-17' })).toEqual({});
    });

    it('dia seguinte ao 18º aniversário → aceito', () => {
      expect(issues({ entryDate: '2026-10-17', birthDate: '2008-10-16' })).toEqual({});
    });

    it('acolhimento retroativo: idade calculada nessa data, não hoje', () => {
      // Tem 18 hoje (2026-10-17), mas tinha 17 no acolhimento de 2026-01-10.
      expect(issues({ entryDate: '2026-01-10', birthDate: '2008-03-01' }).birthDate).toBe(
        ADD_RESIDENT_DATE_MESSAGES.adultAtEntry,
      );
      expect(issues({ entryDate: '2026-03-01', birthDate: '2008-03-01' })).toEqual({});
    });

    it('nascido em 29/02: em ano não bissexto completa 18 em 01/03', () => {
      // Regra de `isAdultBirthDate` (story 202, `subYears` do date-fns): 2026
      // não é bissexto, então em 28/02/2026 ainda faltam horas para os 18.
      expect(issues({ entryDate: '2026-02-28', birthDate: '2008-02-29' }).birthDate).toBe(
        ADD_RESIDENT_DATE_MESSAGES.adultAtEntry,
      );
      expect(issues({ entryDate: '2026-03-01', birthDate: '2008-02-29' })).toEqual({});
    });

    it('sem acolhimento válido não julga a maioridade (erro fica no acolhimento)', () => {
      const result = issues({ entryDate: '2026-12-01', birthDate: '2015-01-01' });
      expect(result.entryDate).toBe(ADMISSION_DATE_MESSAGES.entryFuture);
      expect(result.birthDate).toBeUndefined();
      expect(issues({ entryDate: '', entryDateInvalid: true, birthDate: '2015-01-01' }).birthDate).toBeUndefined();
    });
  });
});
