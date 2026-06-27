import { describe, expect, it } from 'vitest';
import { houseSchema, sanitizeHouseData, BR_STATES } from './constants';

describe('houses/constants', () => {
  it('BR_STATES contém as 27 unidades federativas', () => {
    expect(BR_STATES).toHaveLength(27);
    expect(BR_STATES).toContain('GO');
    expect(BR_STATES).toContain('SP');
  });

  describe('houseSchema', () => {
    it('exige nome', () => {
      const r = houseSchema.safeParse({ name: '' });
      expect(r.success).toBe(false);
    });

    it('aceita capacidade como string numérica via preprocess', () => {
      const r = houseSchema.safeParse({ name: 'Casa', generalCapacity: '10' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.generalCapacity).toBe(10);
    });

    it('capacidade vazia vira undefined', () => {
      const r = houseSchema.safeParse({ name: 'Casa', generalCapacity: '' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.generalCapacity).toBeUndefined();
    });

    it('rejeita UF com tamanho diferente de 2', () => {
      const r = houseSchema.safeParse({ name: 'Casa', state: 'GOI' });
      expect(r.success).toBe(false);
    });
  });

  describe('sanitizeHouseData', () => {
    it('converte strings vazias e capacidades undefined em null', () => {
      const out = sanitizeHouseData({
        name: 'Casa',
        generalCapacity: undefined,
        staffCapacity: undefined,
        address: '',
        city: '',
        state: '',
        coordinatorId: '',
        phone: '',
        isMotherHouse: undefined,
      });
      expect(out.generalCapacity).toBeNull();
      expect(out.staffCapacity).toBeNull();
      expect(out.address).toBeNull();
      expect(out.coordinatorId).toBeNull();
      expect(out.isMotherHouse).toBe(false);
    });

    it('preserva valores preenchidos', () => {
      const out = sanitizeHouseData({
        name: 'Casa',
        generalCapacity: 8,
        staffCapacity: 2,
        address: 'Rua A',
        city: 'Goiânia',
        state: 'GO',
        coordinatorId: 'c1',
        phone: '6230000000',
        isMotherHouse: true,
      });
      expect(out.generalCapacity).toBe(8);
      expect(out.city).toBe('Goiânia');
      expect(out.isMotherHouse).toBe(true);
    });
  });
});
