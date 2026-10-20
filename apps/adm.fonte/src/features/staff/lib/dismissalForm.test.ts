import { describe, expect, it } from 'vitest';
import { STAFF_DISMISSAL_MESSAGES, StaffDismissalReason, type StaffServicePeriod } from '@fonte/types';
import {
  dismissFormDefaults,
  lastPeriodBound,
  makeDismissFormSchema,
  makeReinstateFormSchema,
  openPeriodStart,
  reinstateFormDefaults,
  toDismissPayload,
  toReinstatePayload,
} from './dismissalForm';

const TODAY = '2026-10-20';

function period(startDate: string, endDate: string | null): StaffServicePeriod {
  return { id: startDate, staffId: 's1', houseId: 'h1', startDate, endDate, createdAt: '', updatedAt: '' };
}

const messages = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  result.success ? [] : result.error!.issues.map((i) => i.message);

describe('dismissalForm — desligamento (story 217)', () => {
  const periods = [period('2024-01-01', null), period('2020-01-01', '2020-06-01')];
  const schema = makeDismissFormSchema({ periods, today: TODAY });
  const valid = { date: '2025-01-10', reason: StaffDismissalReason.OWN_REQUEST, notes: '' };

  it('aceita data válida com motivo', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('exige data e motivo', () => {
    expect(messages(schema.safeParse({ date: '', reason: '', notes: '' }))).toEqual(
      expect.arrayContaining(['Informe a data do desligamento.', 'Selecione o motivo.']),
    );
  });

  it('OTHER exige observação', () => {
    const result = schema.safeParse({ ...valid, reason: StaffDismissalReason.OTHER, notes: '  ' });
    expect(messages(result)).toContain(STAFF_DISMISSAL_MESSAGES.notesRequired);
    expect(schema.safeParse({ ...valid, reason: StaffDismissalReason.OTHER, notes: 'x' }).success).toBe(true);
  });

  it('data futura e anterior ao início do período aberto', () => {
    expect(messages(schema.safeParse({ ...valid, date: '2026-10-21' }))).toEqual([
      STAFF_DISMISSAL_MESSAGES.dateFuture,
    ]);
    expect(messages(schema.safeParse({ ...valid, date: '2023-12-31' }))).toEqual([
      STAFF_DISMISSAL_MESSAGES.dateBeforeStart('2024-01-01'),
    ]);
  });

  it('sem período aberto não limita pelo início; today default', () => {
    expect(makeDismissFormSchema({ periods: [] }).safeParse({ ...valid, date: '1999-01-01' }).success).toBe(true);
    expect(dismissFormDefaults(TODAY)).toEqual({ date: TODAY, reason: '', notes: '' });
    expect(dismissFormDefaults().date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('payload apara a observação e manda null quando vazia', () => {
    expect(toDismissPayload({ ...valid, notes: '  saiu  ' })).toEqual({ ...valid, notes: 'saiu' });
    expect(toDismissPayload(valid).notes).toBeNull();
  });

  it('openPeriodStart', () => {
    expect(openPeriodStart(periods)).toBe('2024-01-01');
    expect(openPeriodStart([period('2020-01-01', '2020-06-01')])).toBeNull();
  });
});

describe('dismissalForm — reintegração (story 217)', () => {
  const periods = [period('2024-01-01', '2025-01-10'), period('2020-01-01', '2020-06-01')];
  const schema = makeReinstateFormSchema({ periods, today: TODAY });

  it('aceita a partir do fim do último período (inclusive)', () => {
    expect(schema.safeParse({ date: '2025-01-10', houseId: '' }).success).toBe(true);
  });

  it('recusa antes do fim, futura e vazia', () => {
    expect(messages(schema.safeParse({ date: '2025-01-09', houseId: '' }))).toEqual([
      STAFF_DISMISSAL_MESSAGES.reinstateBeforeLastEnd('2025-01-10'),
    ]);
    expect(messages(schema.safeParse({ date: '2026-10-21', houseId: '' }))).toEqual([
      STAFF_DISMISSAL_MESSAGES.reinstateFuture,
    ]);
    expect(messages(schema.safeParse({ date: '', houseId: '' }))).toEqual(['Informe a data de reintegração.']);
  });

  it('sem períodos não limita; defaults e payload', () => {
    expect(makeReinstateFormSchema({}).safeParse({ date: '1999-01-01', houseId: '' }).success).toBe(true);
    expect(lastPeriodBound([])).toBeNull();
    expect(lastPeriodBound([period('2025-02-01', null), ...periods])).toBe('2025-02-01');
    expect(reinstateFormDefaults('h1', TODAY)).toEqual({ date: TODAY, houseId: 'h1' });
    expect(reinstateFormDefaults(null, TODAY).houseId).toBe('');
    expect(toReinstatePayload({ date: TODAY, houseId: '' })).toEqual({ date: TODAY, houseId: null });
    expect(toReinstatePayload({ date: TODAY, houseId: 'h2' })).toEqual({ date: TODAY, houseId: 'h2' });
  });
});
