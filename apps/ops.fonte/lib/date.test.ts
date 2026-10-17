import { todayInSaoPaulo } from '@fonte/types';
import {
  DATE_FIELD_MESSAGES,
  formatIsoToBr,
  maskBrDate,
  parseBrDate,
  pastOrTodayDateSchema,
} from './date';

describe('lib/date (story 209)', () => {
  describe('maskBrDate', () => {
    it('insere as barras conforme os dígitos chegam', () => {
      expect(maskBrDate('')).toBe('');
      expect(maskBrDate('0')).toBe('0');
      expect(maskBrDate('05')).toBe('05');
      expect(maskBrDate('050')).toBe('05/0');
      expect(maskBrDate('0503')).toBe('05/03');
      expect(maskBrDate('05031')).toBe('05/03/1');
      expect(maskBrDate('05031985')).toBe('05/03/1985');
    });

    it('descarta não dígitos e corta em 8 dígitos', () => {
      expect(maskBrDate('05/03/1985')).toBe('05/03/1985');
      expect(maskBrDate('05-03-1985')).toBe('05/03/1985');
      expect(maskBrDate('ab05c03d1985999')).toBe('05/03/1985');
    });
  });

  describe('parseBrDate', () => {
    it('aceita data real e devolve ISO', () => {
      expect(parseBrDate('05/03/1985')).toBe('1985-03-05');
      expect(parseBrDate(' 29/02/2024 ')).toBe('2024-02-29');
      expect(parseBrDate('31/12/2026')).toBe('2026-12-31');
    });

    it.each([
      ['31/02/2020', 'dia que não existe'],
      ['29/02/2023', '29/02 em ano não bissexto'],
      ['31/04/2020', 'abril tem 30 dias'],
      ['00/01/2020', 'dia zero'],
      ['12/13/2020', 'mês 13'],
      ['12/00/2020', 'mês zero'],
      ['01/01/0000', 'ano zero'],
      ['05/03/19', 'incompleto'],
      ['05/03', 'incompleto'],
      ['', 'vazio'],
      ['ab/cd/efgh', 'não numérico'],
      ['1985-03-05', 'formato ISO'],
    ])('rejeita %s (%s)', (text) => {
      expect(parseBrDate(text)).toBeNull();
    });
  });

  describe('formatIsoToBr', () => {
    it('ISO vira dd/mm/aaaa; vazio continua vazio', () => {
      expect(formatIsoToBr('1985-03-05')).toBe('05/03/1985');
      expect(formatIsoToBr('2026-03-10T00:00:00.000Z')).toBe('10/03/2026');
      expect(formatIsoToBr('')).toBe('');
      expect(formatIsoToBr(null)).toBe('');
      expect(formatIsoToBr(undefined)).toBe('');
    });
  });

  describe('pastOrTodayDateSchema (relógio mockado)', () => {
    afterEach(() => jest.useRealTimers());

    function messageOf(value: string) {
      const result = pastOrTodayDateSchema.safeParse(value);
      return result.success ? null : result.error.issues[0].message;
    }

    it('hoje e retroativo passam; amanhã é futuro', () => {
      jest.useFakeTimers({ now: new Date('2026-10-17T15:00:00Z') });
      expect(messageOf('2026-10-17')).toBeNull();
      expect(messageOf('2020-01-01')).toBeNull();
      expect(messageOf('2026-10-18')).toBe(DATE_FIELD_MESSAGES.future);
    });

    it('vazio (texto incompleto/inválido) pede data válida', () => {
      expect(messageOf('')).toBe(DATE_FIELD_MESSAGES.required);
    });

    it('virada do dia: 22h em São Paulo ainda é "hoje" local, não o dia UTC', () => {
      // 01:00 UTC do dia 18 = 22:00 do dia 17 em São Paulo.
      jest.useFakeTimers({ now: new Date('2026-10-18T01:00:00Z') });
      expect(todayInSaoPaulo()).toBe('2026-10-17');
      expect(messageOf('2026-10-17')).toBeNull();
      // O dia UTC (18) já seria aceito por `toISOString()` — aqui é futuro.
      expect(messageOf('2026-10-18')).toBe(DATE_FIELD_MESSAGES.future);
    });
  });
});
