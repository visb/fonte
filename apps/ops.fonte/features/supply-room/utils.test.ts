import { MovementType } from '@fonte/types';
import {
  toNumber,
  formatQuantity,
  formatDateBR,
  toISODate,
  movementLabel,
} from './utils';

describe('supply-room/utils — re-export de lib/inventoryUtils', () => {
  it('toNumber converte e cai para 0 em valores inválidos', () => {
    expect(toNumber('3.5')).toBe(3.5);
    expect(toNumber(null)).toBe(0);
  });

  it('formatQuantity usa vírgula decimal', () => {
    expect(formatQuantity(2.5)).toBe('2,5');
  });

  it('formatDateBR converte ISO para dd/mm/yyyy', () => {
    expect(formatDateBR('2026-03-10')).toBe('10/03/2026');
  });

  it('toISODate formata uma Date local', () => {
    expect(toISODate(new Date('2026-03-10T00:00:00'))).toBe('2026-03-10');
  });

  it('movementLabel rotula entrada/saída', () => {
    expect(movementLabel(MovementType.IN)).toBe('Entrada');
    expect(movementLabel(MovementType.OUT)).toBe('Saída');
  });
});
