import { describe, expect, it } from 'vitest';
import { bibleClassSchema, addDays } from './bibleCourseSchema';
import { gradeCellSchema, parseGradeCell, formatGrade, formatAverage } from './bibleGradeSchema';
import { bibleModuleSchema } from './bibleModuleSchema';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('bibleClassSchema', () => {
  const valid = {
    name: 'Turma 1',
    houseId: UUID,
    startDate: '2026-06-01',
    endDate: '2026-08-01',
  };

  it('aceita turma válida', () => {
    expect(bibleClassSchema.safeParse(valid).success).toBe(true);
  });

  it('exige nome, houseId uuid e datas', () => {
    expect(bibleClassSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
    expect(bibleClassSchema.safeParse({ ...valid, houseId: 'nope' }).success).toBe(false);
    expect(bibleClassSchema.safeParse({ ...valid, startDate: '' }).success).toBe(false);
  });

  it('término não pode ser antes do início', () => {
    const res = bibleClassSchema.safeParse({ ...valid, endDate: '2026-05-01' });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues.some((i) => i.path.includes('endDate'))).toBe(true);
  });
});

describe('addDays', () => {
  it('soma dias mantendo YYYY-MM-DD', () => {
    expect(addDays('2026-06-01', 30)).toBe('2026-07-01');
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
  });
});

describe('gradeCellSchema / parseGradeCell', () => {
  it('vazio vira null', () => {
    expect(gradeCellSchema.parse('')).toBeNull();
  });

  it('número 0–10 é aceito; fora do intervalo é rejeitado', () => {
    expect(gradeCellSchema.parse('7.5')).toBe(7.5);
    expect(gradeCellSchema.safeParse('11').success).toBe(false);
    expect(gradeCellSchema.safeParse('-1').success).toBe(false);
  });

  it('parseGradeCell troca vírgula por ponto e devolve value', () => {
    expect(parseGradeCell('8,5')).toEqual({ value: 8.5 });
    expect(parseGradeCell('  ')).toEqual({ value: null });
  });

  it('parseGradeCell devolve error para valor inválido', () => {
    const out = parseGradeCell('20');
    expect('error' in out).toBe(true);
  });
});

describe('formatGrade / formatAverage', () => {
  it('formatGrade: null → vazio, número → string', () => {
    expect(formatGrade(null)).toBe('');
    expect(formatGrade(9)).toBe('9');
  });

  it('formatAverage: null → travessão, número com 1 casa e vírgula', () => {
    expect(formatAverage(null)).toBe('–');
    expect(formatAverage(7.25)).toBe('7,3');
  });
});

describe('bibleModuleSchema', () => {
  it('aceita módulo válido e coage sequence', () => {
    const parsed = bibleModuleSchema.parse({ name: 'Mód 1', sequence: '2' });
    expect(parsed.sequence).toBe(2);
  });

  it('exige nome e ordem >= 0 inteira', () => {
    expect(bibleModuleSchema.safeParse({ name: '', sequence: 1 }).success).toBe(false);
    expect(bibleModuleSchema.safeParse({ name: 'X', sequence: -1 }).success).toBe(false);
    expect(bibleModuleSchema.safeParse({ name: 'X', sequence: 1.5 }).success).toBe(false);
  });
});
