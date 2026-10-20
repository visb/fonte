import { IsNull } from 'typeorm';
import { ACTIVE_STAFF_WHERE, activeStaffSql, isActiveStaff } from './active-staff';

describe('predicado de servo ativo (story 217)', () => {
  it('activeStaffSql cobre soft delete e desligamento com o alias dado', () => {
    expect(activeStaffSql('s')).toBe('s.deleted_at IS NULL AND s.dismissed_at IS NULL');
    expect(activeStaffSql('st')).toBe('st.deleted_at IS NULL AND st.dismissed_at IS NULL');
  });

  it('ACTIVE_STAFF_WHERE filtra dismissedAt nulo', () => {
    expect(ACTIVE_STAFF_WHERE).toEqual({ dismissedAt: IsNull() });
  });

  it('isActiveStaff', () => {
    expect(isActiveStaff({})).toBe(true);
    expect(isActiveStaff({ deletedAt: null, dismissedAt: null })).toBe(true);
    expect(isActiveStaff({ dismissedAt: '2026-01-01' })).toBe(false);
    expect(isActiveStaff({ deletedAt: new Date() })).toBe(false);
  });
});
