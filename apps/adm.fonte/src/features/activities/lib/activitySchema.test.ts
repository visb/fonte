import { describe, expect, it } from 'vitest';
import { activitySchema } from './activitySchema';

describe('activitySchema', () => {
  it('exige título', () => {
    const res = activitySchema.safeParse({ title: '' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('O título é obrigatório');
    }
  });

  it('aceita só o título (descrição e casa opcionais)', () => {
    expect(activitySchema.safeParse({ title: 'Limpeza' }).success).toBe(true);
  });

  it('aceita descrição e houseId', () => {
    const res = activitySchema.safeParse({
      title: 'Reunião',
      description: 'pauta',
      houseId: 'h1',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.description).toBe('pauta');
      expect(res.data.houseId).toBe('h1');
    }
  });
});
