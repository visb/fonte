import { BadRequestException } from '@nestjs/common';
import {
  ADMISSION_DATE_MESSAGES,
  findAdmissionDatesIssue,
  formatIsoDateBr,
  isDateBefore,
  isFutureDate,
} from '@fonte/types';
import { assertAdmissionDates } from './admission-dates';

// Story 203 — a regra mora em @fonte/types (sem runner próprio); é testada aqui
// junto do guard do backend que a consome.
const TODAY = '2026-10-16';
const TOMORROW = '2026-10-17';
const YESTERDAY = '2026-10-15';

describe('@fonte/types — datas de entrada e saída (story 203)', () => {
  describe('isFutureDate', () => {
    it('hoje não é futuro; amanhã é; ontem não', () => {
      expect(isFutureDate(TODAY, TODAY)).toBe(false);
      expect(isFutureDate(TOMORROW, TODAY)).toBe(true);
      expect(isFutureDate(YESTERDAY, TODAY)).toBe(false);
    });

    it('ignora sufixo de hora nos dois lados', () => {
      expect(isFutureDate('2026-10-16T23:59:00Z', '2026-10-16T00:00:00Z')).toBe(false);
      expect(isFutureDate('2026-10-17T00:00:00Z', TODAY)).toBe(true);
    });

    it('valor fora do formato não é julgado', () => {
      expect(isFutureDate('amanhã', TODAY)).toBe(false);
    });
  });

  describe('isDateBefore (comparação de pares)', () => {
    it('saída = entrada passa; saída = entrada − 1 dia falha', () => {
      expect(isDateBefore(TODAY, TODAY)).toBe(false);
      expect(isDateBefore(YESTERDAY, TODAY)).toBe(true);
      expect(isDateBefore(TOMORROW, TODAY)).toBe(false);
    });

    it('valor fora do formato não é julgado', () => {
      expect(isDateBefore('x', TODAY)).toBe(false);
      expect(isDateBefore(TODAY, 'x')).toBe(false);
    });
  });

  it('formatIsoDateBr', () => {
    expect(formatIsoDateBr('2026-03-05')).toBe('05/03/2026');
    expect(formatIsoDateBr('2026-03-05T10:00:00Z')).toBe('05/03/2026');
    expect(formatIsoDateBr('ontem')).toBe('ontem');
  });

  it('mensagens com a data no formato dd/mm/aaaa', () => {
    expect(ADMISSION_DATE_MESSAGES.exitBeforeEntry('2026-01-02')).toBe(
      'A data de saída não pode ser anterior à data de entrada (02/01/2026).',
    );
    expect(ADMISSION_DATE_MESSAGES.entryBeforePreviousExit('2025-12-31')).toBe(
      'A data de entrada não pode ser anterior à saída do acolhimento anterior (31/12/2025).',
    );
  });

  describe('findAdmissionDatesIssue', () => {
    const opts = { today: TODAY };

    it('par válido (inclusive mesmo dia e hoje) → null', () => {
      expect(findAdmissionDatesIssue({ entryDate: TODAY, exitDate: TODAY }, opts)).toBeNull();
      expect(findAdmissionDatesIssue({}, opts)).toBeNull();
      expect(findAdmissionDatesIssue({ entryDate: null, exitDate: '' }, opts)).toBeNull();
    });

    it('entrada futura → campo entryDate', () => {
      expect(findAdmissionDatesIssue({ entryDate: TOMORROW }, opts)).toEqual({
        field: 'entryDate',
        message: ADMISSION_DATE_MESSAGES.entryFuture,
      });
    });

    it('entrada antes da saída anterior → campo entryDate; igual passa', () => {
      expect(
        findAdmissionDatesIssue({ entryDate: YESTERDAY }, { ...opts, previousExitDate: TODAY }),
      ).toEqual({
        field: 'entryDate',
        message: ADMISSION_DATE_MESSAGES.entryBeforePreviousExit(TODAY),
      });
      expect(
        findAdmissionDatesIssue({ entryDate: TODAY }, { ...opts, previousExitDate: TODAY }),
      ).toBeNull();
    });

    it('saída futura → campo exitDate', () => {
      expect(findAdmissionDatesIssue({ entryDate: TODAY, exitDate: TOMORROW }, opts)).toEqual({
        field: 'exitDate',
        message: ADMISSION_DATE_MESSAGES.exitFuture,
      });
    });

    it('saída antes da entrada → campo exitDate', () => {
      expect(findAdmissionDatesIssue({ entryDate: TODAY, exitDate: YESTERDAY }, opts)).toEqual({
        field: 'exitDate',
        message: ADMISSION_DATE_MESSAGES.exitBeforeEntry(TODAY),
      });
    });

    it('check limita o que é julgado; o par vale se um dos dois é julgado', () => {
      const legacy = { entryDate: TOMORROW, exitDate: '2030-01-01' };
      expect(
        findAdmissionDatesIssue(legacy, { ...opts, check: { entryDate: false, exitDate: false } }),
      ).toBeNull();
      expect(
        findAdmissionDatesIssue(
          { entryDate: TODAY, exitDate: YESTERDAY },
          { ...opts, check: { entryDate: false, exitDate: true } },
        )?.message,
      ).toBe(ADMISSION_DATE_MESSAGES.exitBeforeEntry(TODAY));
    });
  });
});

describe('assertAdmissionDates (story 203)', () => {
  const today = TODAY;

  describe('criação (sem previous)', () => {
    it('entrada hoje passa; entrada amanhã → 400', () => {
      expect(() => assertAdmissionDates({ entryDate: TODAY }, { today })).not.toThrow();
      expect(() => assertAdmissionDates({ entryDate: TOMORROW }, { today })).toThrow(
        BadRequestException,
      );
      expect(() => assertAdmissionDates({ entryDate: TOMORROW }, { today })).toThrow(
        ADMISSION_DATE_MESSAGES.entryFuture,
      );
    });

    it('saída = entrada passa; saída < entrada → 400; saída amanhã → 400', () => {
      expect(() =>
        assertAdmissionDates({ entryDate: YESTERDAY, exitDate: YESTERDAY }, { today }),
      ).not.toThrow();
      expect(() =>
        assertAdmissionDates({ entryDate: TODAY, exitDate: YESTERDAY }, { today }),
      ).toThrow(ADMISSION_DATE_MESSAGES.exitBeforeEntry(TODAY));
      expect(() =>
        assertAdmissionDates({ entryDate: TODAY, exitDate: TOMORROW }, { today }),
      ).toThrow(ADMISSION_DATE_MESSAGES.exitFuture);
    });

    it('sem datas passa; sem `today` usa a data de São Paulo', () => {
      expect(() => assertAdmissionDates({})).not.toThrow();
      expect(() => assertAdmissionDates({ entryDate: null, exitDate: null })).not.toThrow();
      expect(() => assertAdmissionDates({ entryDate: '2999-01-01' })).toThrow(
        ADMISSION_DATE_MESSAGES.entryFuture,
      );
    });

    it('aceita Date (hidratação da entidade)', () => {
      expect(() =>
        assertAdmissionDates({ entryDate: new Date('2027-01-01T00:00:00Z') }, { today }),
      ).toThrow(ADMISSION_DATE_MESSAGES.entryFuture);
    });
  });

  describe('edição (com previous)', () => {
    const stored = { entryDate: '2026-05-10', exitDate: null };

    it('alta com saída antes da entrada gravada → 400', () => {
      expect(() =>
        assertAdmissionDates({ exitDate: '2026-05-09' }, { previous: stored, today }),
      ).toThrow(ADMISSION_DATE_MESSAGES.exitBeforeEntry('2026-05-10'));
    });

    it('alta com saída futura → 400', () => {
      expect(() =>
        assertAdmissionDates({ exitDate: TOMORROW }, { previous: stored, today }),
      ).toThrow(ADMISSION_DATE_MESSAGES.exitFuture);
    });

    it('alterar entrada para depois da saída gravada → 400', () => {
      expect(() =>
        assertAdmissionDates(
          { entryDate: '2026-06-01' },
          { previous: { entryDate: '2026-01-01', exitDate: '2026-05-01' }, today },
        ),
      ).toThrow(ADMISSION_DATE_MESSAGES.exitBeforeEntry('2026-06-01'));
    });

    it('ficha legada incoerente + payload sem datas → ok', () => {
      const legacy = { entryDate: '2062-01-01', exitDate: '2020-01-01' };
      expect(() => assertAdmissionDates({}, { previous: legacy, today })).not.toThrow();
    });

    it('reenvio idempotente (mesmas datas gravadas, inclusive como Date) → ok', () => {
      const legacy = {
        entryDate: new Date('2026-05-10T00:00:00Z'),
        exitDate: '2026-05-01',
      };
      expect(() =>
        assertAdmissionDates(
          { entryDate: '2026-05-10', exitDate: '2026-05-01' },
          { previous: legacy, today },
        ),
      ).not.toThrow();
    });

    it('alta com saída válida (≥ entrada gravada, não futura) → ok', () => {
      expect(() =>
        assertAdmissionDates(
          { exitDate: TODAY },
          { previous: { entryDate: '2026-01-01', exitDate: null }, today },
        ),
      ).not.toThrow();
    });

    it('limpar a saída passa', () => {
      expect(() =>
        assertAdmissionDates(
          { exitDate: null },
          { previous: { entryDate: '2026-01-01', exitDate: '2025-01-01' }, today },
        ),
      ).not.toThrow();
    });
  });

  describe('readmissão (previousExitDate)', () => {
    it('entrada antes da última saída → 400; igual passa; futura → 400', () => {
      expect(() =>
        assertAdmissionDates({ entryDate: '2026-09-01' }, { previousExitDate: '2026-09-02', today }),
      ).toThrow(ADMISSION_DATE_MESSAGES.entryBeforePreviousExit('2026-09-02'));
      expect(() =>
        assertAdmissionDates({ entryDate: '2026-09-02' }, { previousExitDate: '2026-09-02', today }),
      ).not.toThrow();
      expect(() =>
        assertAdmissionDates({ entryDate: TOMORROW }, { previousExitDate: null, today }),
      ).toThrow(ADMISSION_DATE_MESSAGES.entryFuture);
    });

    it('última saída como Date', () => {
      expect(() =>
        assertAdmissionDates(
          { entryDate: '2026-09-01' },
          { previousExitDate: new Date('2026-09-05T00:00:00Z'), today },
        ),
      ).toThrow(BadRequestException);
    });
  });
});
