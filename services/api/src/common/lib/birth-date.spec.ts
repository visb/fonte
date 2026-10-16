import { BadRequestException } from '@nestjs/common';
import {
  isAdultBirthDate,
  maxBirthDateFor,
  MIN_AGE_MESSAGE,
  MIN_PERSON_AGE,
  todayInSaoPaulo,
} from '@fonte/types';
import { assertAdultBirthDate } from './birth-date';

// Story 202 — a regra mora em @fonte/types (sem runner próprio); é testada aqui
// junto do guard do backend que a consome.
describe('@fonte/types — maioridade (story 202)', () => {
  it('MIN_PERSON_AGE é 18', () => {
    expect(MIN_PERSON_AGE).toBe(18);
  });

  describe('maxBirthDateFor', () => {
    it('recua 18 anos mantendo mês e dia', () => {
      expect(maxBirthDateFor('2026-10-16')).toBe('2008-10-16');
    });

    it('29/02 avaliado num ano cujo alvo não é bissexto vira 28/02', () => {
      // 2028 - 18 = 2010 (não bissexto)
      expect(maxBirthDateFor('2028-02-29')).toBe('2010-02-28');
    });

    it('29/02 com alvo bissexto é preservado (ramo da aritmética)', () => {
      // 18 não é múltiplo de 4: no calendário real hoje e alvo nunca são ambos
      // bissextos. A entrada sintética só exercita o ramo do cálculo.
      expect(maxBirthDateFor('2018-02-29')).toBe('2000-02-29');
    });

    it('ignora sufixo de hora', () => {
      expect(maxBirthDateFor('2026-01-05T23:00:00Z')).toBe('2008-01-05');
    });

    it('lança para valor fora do formato', () => {
      expect(() => maxBirthDateFor('16/10/2026')).toThrow('Data inválida');
    });
  });

  describe('isAdultBirthDate', () => {
    const today = '2026-10-16';

    it('faz 18 anos hoje → adulto', () => {
      expect(isAdultBirthDate('2008-10-16', today)).toBe(true);
    });

    it('faz 18 anos amanhã → não adulto', () => {
      expect(isAdultBirthDate('2008-10-17', today)).toBe(false);
    });

    it('17 anos → não adulto; 40 anos → adulto', () => {
      expect(isAdultBirthDate('2009-03-01', today)).toBe(false);
      expect(isAdultBirthDate('1986-03-01', today)).toBe(true);
    });

    it('nascido em 29/02 avaliado em ano não bissexto: completa em 28/02', () => {
      // nascido 2008-02-29; em 2026-02-28 o limite é 2008-02-28 → ainda não
      expect(isAdultBirthDate('2008-02-29', '2026-02-28')).toBe(false);
      expect(isAdultBirthDate('2008-02-29', '2026-03-01')).toBe(true);
    });

    it('aceita valor com hora (ISO completo)', () => {
      expect(isAdultBirthDate('1990-05-05T00:00:00.000Z', today)).toBe(true);
    });

    it('valor fora do formato não é julgado aqui', () => {
      expect(isAdultBirthDate('', today)).toBe(true);
      expect(isAdultBirthDate('ontem', today)).toBe(true);
    });
  });

  describe('todayInSaoPaulo', () => {
    it('23h30 de Brasília (02h30 UTC do dia seguinte) devolve o dia de Brasília', () => {
      expect(todayInSaoPaulo(new Date('2026-10-17T02:30:00Z'))).toBe('2026-10-16');
    });

    it('03h00 UTC já é meia-noite em Brasília', () => {
      expect(todayInSaoPaulo(new Date('2026-10-17T03:00:00Z'))).toBe('2026-10-17');
    });

    it('sem argumento usa o relógio atual', () => {
      expect(todayInSaoPaulo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('runtime sem Intl com fuso cai no deslocamento fixo UTC−3', () => {
      const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
        throw new RangeError('timeZone não suportado');
      });
      try {
        expect(todayInSaoPaulo(new Date('2026-10-17T02:30:00Z'))).toBe('2026-10-16');
      } finally {
        spy.mockRestore();
      }
    });

    it('formatToParts sem as partes esperadas também cai no fallback', () => {
      const spy = jest
        .spyOn(Intl, 'DateTimeFormat')
        .mockImplementation(
          () => ({ formatToParts: () => [] }) as unknown as Intl.DateTimeFormat,
        );
      try {
        expect(todayInSaoPaulo(new Date('2026-10-17T03:30:00Z'))).toBe('2026-10-17');
      } finally {
        spy.mockRestore();
      }
    });
  });
});

describe('assertAdultBirthDate (story 202)', () => {
  const today = '2026-10-16';
  const minor = '2010-01-01';
  const adult = '1980-01-01';

  it('nulo, indefinido ou vazio passa (campo opcional)', () => {
    expect(() => assertAdultBirthDate(null, undefined, today)).not.toThrow();
    expect(() => assertAdultBirthDate(undefined, minor, today)).not.toThrow();
    expect(() => assertAdultBirthDate('', undefined, today)).not.toThrow();
  });

  it('criação com menor → 400 com a mensagem única', () => {
    expect(() => assertAdultBirthDate(minor, undefined, today)).toThrow(BadRequestException);
    expect(() => assertAdultBirthDate(minor, undefined, today)).toThrow(MIN_AGE_MESSAGE);
  });

  it('criação com adulto passa; 18 anos hoje passa', () => {
    expect(() => assertAdultBirthDate(adult, undefined, today)).not.toThrow();
    expect(() => assertAdultBirthDate('2008-10-16', null, today)).not.toThrow();
  });

  it('edição com a mesma data gravada (menor legado) passa', () => {
    expect(() => assertAdultBirthDate(minor, minor, today)).not.toThrow();
    // gravada como Date (hidratação da entidade)
    expect(() => assertAdultBirthDate(minor, new Date(`${minor}T00:00:00Z`), today)).not.toThrow();
  });

  it('edição alterando para menor → 400', () => {
    expect(() => assertAdultBirthDate(minor, adult, today)).toThrow(MIN_AGE_MESSAGE);
  });

  it('aceita Date como valor novo', () => {
    expect(() => assertAdultBirthDate(new Date('1970-02-02T00:00:00Z'), null, today)).not.toThrow();
  });

  it('sem `today` usa a data de São Paulo', () => {
    expect(() => assertAdultBirthDate('1950-01-01')).not.toThrow();
    expect(() => assertAdultBirthDate('2999-01-01')).toThrow(MIN_AGE_MESSAGE);
  });
});
