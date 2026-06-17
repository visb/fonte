import { MovementType } from '@fonte/types';
import {
  toNumber,
  formatQuantity,
  formatDateBR,
  toISODate,
  movementLabel,
} from './inventoryUtils';

describe('inventoryUtils', () => {
  describe('toNumber', () => {
    it('converte string numérica', () => {
      expect(toNumber('12.5')).toBe(12.5);
    });

    it('retorna 0 para null/undefined', () => {
      expect(toNumber(null)).toBe(0);
      expect(toNumber(undefined)).toBe(0);
    });

    it('retorna 0 para valor não finito (NaN)', () => {
      expect(toNumber('abc')).toBe(0);
    });

    it('mantém número como está', () => {
      expect(toNumber(7)).toBe(7);
    });
  });

  describe('formatQuantity', () => {
    it('formata com vírgula decimal', () => {
      expect(formatQuantity(12.5)).toBe('12,5');
    });

    it('arredonda para 2 casas decimais', () => {
      expect(formatQuantity(3.14159)).toBe('3,14');
    });

    it('formata inteiro sem casas', () => {
      expect(formatQuantity(10)).toBe('10');
    });

    it('trata entrada inválida como 0', () => {
      expect(formatQuantity('xyz')).toBe('0');
    });
  });

  describe('formatDateBR', () => {
    it('converte ISO para dd/mm/aaaa', () => {
      expect(formatDateBR('2026-06-17')).toBe('17/06/2026');
    });

    it('lida com timestamp ISO completo', () => {
      expect(formatDateBR('2026-06-17T10:30:00.000Z')).toBe('17/06/2026');
    });

    it('retorna a entrada se não for parseável', () => {
      expect(formatDateBR('texto-invalido')).toBe('texto-invalido');
    });
  });

  describe('toISODate', () => {
    it('formata Date para aaaa-mm-dd com zero-padding', () => {
      const d = new Date(2026, 0, 5); // 5 jan 2026
      expect(toISODate(d)).toBe('2026-01-05');
    });
  });

  describe('movementLabel', () => {
    it('rotula entrada', () => {
      expect(movementLabel(MovementType.IN)).toBe('Entrada');
    });

    it('rotula saída', () => {
      expect(movementLabel(MovementType.OUT)).toBe('Saída');
    });
  });
});
