import { describe, expect, it } from 'vitest';
import { eventSchema } from './eventSchema';

const base = {
  title: 'Retiro',
  description: 'Encontro',
  startAt: '2026-08-01T18:00',
};

describe('eventSchema', () => {
  it('aceita um evento mínimo válido (sem fim/capacidade/inscrição)', () => {
    const result = eventSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('aceita capacity vazio como ilimitado (undefined)', () => {
    const result = eventSchema.safeParse({ ...base, capacity: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.capacity).toBeUndefined();
  });

  it('rejeita endAt anterior a startAt', () => {
    const result = eventSchema.safeParse({
      ...base,
      endAt: '2026-07-31T18:00',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('endAt'))).toBe(true);
    }
  });

  it('aceita endAt igual ou posterior a startAt', () => {
    expect(eventSchema.safeParse({ ...base, endAt: '2026-08-01T20:00' }).success).toBe(true);
  });

  it('rejeita janela de inscrição incoerente (fecha antes de abrir)', () => {
    const result = eventSchema.safeParse({
      ...base,
      registrationOpensAt: '2026-07-20T00:00',
      registrationClosesAt: '2026-07-10T00:00',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes('registrationClosesAt')),
      ).toBe(true);
    }
  });

  it('rejeita título vazio', () => {
    expect(eventSchema.safeParse({ ...base, title: '' }).success).toBe(false);
  });

  it('rejeita capacity zero ou negativo', () => {
    expect(eventSchema.safeParse({ ...base, capacity: '0' }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, capacity: '-3' }).success).toBe(false);
  });
});
