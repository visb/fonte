import { describe, expect, it } from 'vitest';
import { auditFiltersSchema, EMPTY_AUDIT_FILTERS, formatDateTime, shortId, toApiFilters } from './utils';
import {
  actionLabel,
  contextLabel,
  fieldLabel,
  formatChangeValue,
  reasonLabel,
  targetTypeLabel,
  ACTION_OPTIONS,
} from './constants';

describe('toApiFilters', () => {
  it('sem filtros → objeto vazio (API aplica os últimos 30 dias)', () => {
    expect(toApiFilters(EMPTY_AUDIT_FILTERS)).toEqual({});
  });

  it('datas locais viram instantes; o dia final entra inteiro (fim exclusivo)', () => {
    const f = toApiFilters({ ...EMPTY_AUDIT_FILTERS, from: '2026-10-01', to: '2026-10-17' });
    expect(f.from).toBe(new Date(2026, 9, 1).toISOString());
    expect(f.to).toBe(new Date(2026, 9, 18).toISOString());
  });

  it('repassa os demais filtros e apara o id', () => {
    expect(
      toApiFilters({
        ...EMPTY_AUDIT_FILTERS,
        action: 'resident.update',
        houseId: 'h1',
        userId: 'u1',
        outcome: 'FAILURE',
        targetId: '  6f1c3b8e-1d2a-4b9c-9e8f-0a1b2c3d4e5f ',
      }),
    ).toEqual({
      action: 'resident.update',
      houseId: 'h1',
      userId: 'u1',
      outcome: 'FAILURE',
      targetId: '6f1c3b8e-1d2a-4b9c-9e8f-0a1b2c3d4e5f',
    });
  });
});

describe('auditFiltersSchema', () => {
  it('recusa período invertido e id malformado', () => {
    const inverted = auditFiltersSchema.safeParse({ ...EMPTY_AUDIT_FILTERS, from: '2026-10-10', to: '2026-10-01' });
    expect(inverted.success).toBe(false);
    const badId = auditFiltersSchema.safeParse({ ...EMPTY_AUDIT_FILTERS, targetId: 'xyz' });
    expect(badId.success).toBe(false);
    expect(auditFiltersSchema.safeParse(EMPTY_AUDIT_FILTERS).success).toBe(true);
  });
});

describe('formatação', () => {
  it('formatDateTime e shortId', () => {
    expect(formatDateTime('2026-10-17T12:00:00.000Z')).toBe(new Date('2026-10-17T12:00:00.000Z').toLocaleString('pt-BR'));
    expect(shortId(null)).toBe('—');
    expect(shortId('abc')).toBe('abc');
    expect(shortId('6f1c3b8e-1d2a')).toBe('6f1c3b8e…');
  });

  it('valores de antes/depois: vazio, protegido, arquivo, booleano, lista e objeto', () => {
    expect(formatChangeValue(null, false)).toBe('(vazio)');
    expect(formatChangeValue('', false)).toBe('(vazio)');
    expect(formatChangeValue(null, true)).toBe('Dado protegido');
    expect(formatChangeValue('***00', true)).toBe('***00');
    expect(formatChangeValue('[arquivo]', false)).toBe('Arquivo');
    expect(formatChangeValue(true, false)).toBe('Sim');
    expect(formatChangeValue(false, false)).toBe('Não');
    expect(formatChangeValue(['a', 'b'], false)).toBe('a, b');
    expect(formatChangeValue({ name: 'X' }, false)).toBe('Nome: X');
    expect(formatChangeValue(700, false)).toBe('700');
  });

  it('rótulos legíveis com fallback para o valor cru', () => {
    expect(actionLabel('resident.update')).toBe('Ficha do filho editada');
    expect(actionLabel('x.y')).toBe('x.y');
    expect(targetTypeLabel('resident')).toBe('Filho');
    expect(targetTypeLabel(null)).toBe('—');
    expect(targetTypeLabel('zzz')).toBe('zzz');
    expect(fieldLabel('houseId')).toBe('Casa');
    expect(fieldLabel('zzz')).toBe('zzz');
    expect(reasonLabel(null)).toBeNull();
    expect(reasonLabel('INACTIVE_USER')).toBe('Usuário inativo');
    expect(reasonLabel('OUTRO')).toBe('OUTRO');
    expect(contextLabel('templateIds')).toBe('Templates');
    expect(contextLabel('zzz')).toBe('zzz');
    expect(ACTION_OPTIONS.find((o) => o.value === 'auth.login')?.label).toBe('Login');
  });
});
