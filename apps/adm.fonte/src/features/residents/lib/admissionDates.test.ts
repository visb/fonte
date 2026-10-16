import { describe, expect, it } from 'vitest';
import { ADMISSION_DATE_MESSAGES } from '@fonte/types';
import { admissionDatesIssue, importAdmissionsIssues, lastExitDate } from './admissionDates';

const today = '2026-10-16';

describe('admissionDatesIssue (story 203)', () => {
  it('criação julga tudo; vazio passa', () => {
    expect(admissionDatesIssue({}, { today })).toBeNull();
    expect(admissionDatesIssue({ entryDate: '2026-10-17' }, { today })).toEqual({
      field: 'entryDate',
      message: ADMISSION_DATE_MESSAGES.entryFuture,
    });
  });

  it('edição sem alteração não julga', () => {
    const initial = { entryDate: '2062-01-01', exitDate: '2020-01-01' };
    expect(admissionDatesIssue(initial, { initial, today })).toBeNull();
  });

  it('edição: saída alterada para antes da entrada acusa a saída', () => {
    expect(
      admissionDatesIssue(
        { entryDate: '2026-05-10', exitDate: '2026-05-01' },
        { initial: { entryDate: '2026-05-10', exitDate: null }, today },
      ),
    ).toEqual({ field: 'exitDate', message: ADMISSION_DATE_MESSAGES.exitBeforeEntry('2026-05-10') });
  });

  it('readmissão: entrada antes da última saída', () => {
    expect(
      admissionDatesIssue({ entryDate: '2026-05-01' }, { previousExitDate: '2026-05-02T00:00:00Z', today }),
    ).toEqual({
      field: 'entryDate',
      message: ADMISSION_DATE_MESSAGES.entryBeforePreviousExit('2026-05-02'),
    });
  });

  it('sem `today` usa a data de São Paulo', () => {
    expect(admissionDatesIssue({ entryDate: '2999-01-01' })?.message).toBe(
      ADMISSION_DATE_MESSAGES.entryFuture,
    );
  });
});

describe('lastExitDate', () => {
  it('maior saída entre histórico e ficha; null sem saída', () => {
    expect(lastExitDate([{ exitDate: '2024-01-01' }, { exitDate: null }], '2025-03-01T00:00:00Z')).toBe(
      '2025-03-01',
    );
    expect(lastExitDate([{ exitDate: '2026-01-01' }], null)).toBe('2026-01-01');
    expect(lastExitDate(undefined, undefined)).toBeNull();
  });
});

describe('importAdmissionsIssues', () => {
  it('mensagem por passagem, null quando válida', () => {
    expect(
      importAdmissionsIssues(
        [
          { entryDate: '2020-05-10', exitDate: '2020-05-01' },
          { entryDate: '2023-01-01', exitDate: null },
        ],
        today,
      ),
    ).toEqual([ADMISSION_DATE_MESSAGES.exitBeforeEntry('2020-05-10'), null]);
    expect(importAdmissionsIssues([{ entryDate: '2999-01-01' }])).toEqual([
      ADMISSION_DATE_MESSAGES.entryFuture,
    ]);
  });
});
