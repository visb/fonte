import { describe, expect, it } from 'vitest';
import {
  findServicePeriodDatesIssue,
  findServicePeriodOverlap,
  SERVICE_PERIOD_MESSAGES,
  type StaffServicePeriod,
} from '@fonte/types';
import {
  makeServicePeriodFormSchema,
  servicePeriodFormDefaults,
  servicePeriodFormMode,
  toCreateServicePeriodPayload,
  toUpdateServicePeriodPayload,
} from './servicePeriodForm';

const TODAY = '2026-10-20';

function period(overrides: Partial<StaffServicePeriod>): StaffServicePeriod {
  return {
    id: 'old',
    staffId: 's1',
    houseId: 'h1',
    startDate: '2020-01-01',
    endDate: '2020-06-30',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const open = period({ id: 'open', startDate: '2024-01-10', endDate: null });
const old = period({});
const periods = [open, old];

function messages(result: ReturnType<ReturnType<typeof makeServicePeriodFormSchema>['safeParse']>) {
  return result.success ? [] : result.error.issues.map((i) => `${i.path[0]}: ${i.message}`);
}

describe('servicePeriodFormMode / defaults', () => {
  it('create sem período, open sem fim, edit com fim', () => {
    expect(servicePeriodFormMode()).toBe('create');
    expect(servicePeriodFormMode(open)).toBe('open');
    expect(servicePeriodFormMode(old)).toBe('edit');
  });

  it('defaults vazios ou do período', () => {
    expect(servicePeriodFormDefaults()).toEqual({ houseId: '', startDate: '', endDate: '' });
    expect(servicePeriodFormDefaults(period({ houseId: null }))).toEqual({
      houseId: '',
      startDate: '2020-01-01',
      endDate: '2020-06-30',
    });
  });
});

describe('makeServicePeriodFormSchema', () => {
  const create = makeServicePeriodFormSchema({ mode: 'create', periods, today: TODAY });

  it('exige início e fim na criação', () => {
    expect(messages(create.safeParse({ houseId: '', startDate: '', endDate: '' }))).toEqual([
      'startDate: Informe a data de início.',
      `endDate: ${SERVICE_PERIOD_MESSAGES.endDateRequired}`,
    ]);
  });

  it('datas futuras e fim < início', () => {
    expect(messages(create.safeParse({ houseId: '', startDate: '2027-01-01', endDate: '2027-02-01' }))).toEqual([
      `startDate: ${SERVICE_PERIOD_MESSAGES.startFuture}`,
    ]);
    expect(messages(create.safeParse({ houseId: '', startDate: '2021-01-01', endDate: '2027-02-01' }))).toEqual([
      `endDate: ${SERVICE_PERIOD_MESSAGES.endFuture}`,
    ]);
    expect(messages(create.safeParse({ houseId: '', startDate: '2021-06-01', endDate: '2021-01-01' }))).toEqual([
      `endDate: ${SERVICE_PERIOD_MESSAGES.endBeforeStart('2021-06-01')}`,
    ]);
  });

  it('sobreposição com encerrado ou aberto', () => {
    expect(messages(create.safeParse({ houseId: '', startDate: '2020-05-01', endDate: '2020-12-01' }))).toEqual([
      `startDate: ${SERVICE_PERIOD_MESSAGES.overlap('2020-01-01', '2020-06-30')}`,
    ]);
    expect(messages(create.safeParse({ houseId: '', startDate: '2024-02-01', endDate: '2024-03-01' }))).toEqual([
      `startDate: ${SERVICE_PERIOD_MESSAGES.overlap('2024-01-10', null)}`,
    ]);
    expect(create.safeParse({ houseId: 'h1', startDate: '2021-01-01', endDate: '2021-06-01' }).success).toBe(true);
  });

  it('período aberto: só o início importa; o próprio período não conta na sobreposição', () => {
    const schema = makeServicePeriodFormSchema({ mode: 'open', period: open, periods, today: TODAY });
    expect(schema.safeParse({ houseId: '', startDate: '2023-12-01', endDate: '' }).success).toBe(true);
    expect(messages(schema.safeParse({ houseId: '', startDate: '2020-03-01', endDate: '' }))).toEqual([
      `startDate: ${SERVICE_PERIOD_MESSAGES.overlap('2020-01-01', '2020-06-30')}`,
    ]);
  });

  it('edição sem mudança de datas não julga (registro legado salva)', () => {
    const legacy = period({ startDate: '2020-06-01', endDate: '2020-01-01' });
    const schema = makeServicePeriodFormSchema({ mode: 'edit', period: legacy, periods: [legacy] });
    expect(schema.safeParse({ houseId: 'h2', startDate: '2020-06-01', endDate: '2020-01-01' }).success).toBe(true);
  });
});

describe('payloads', () => {
  it('create normaliza casa vazia para null', () => {
    expect(toCreateServicePeriodPayload({ houseId: '', startDate: '2020-01-01', endDate: '2020-02-01' })).toEqual({
      houseId: null,
      startDate: '2020-01-01',
      endDate: '2020-02-01',
    });
  });

  it('update manda só o que mudou; no aberto só o início', () => {
    expect(toUpdateServicePeriodPayload({ houseId: 'h2', startDate: '2020-01-01', endDate: '2020-07-01' }, old)).toEqual({
      houseId: 'h2',
      endDate: '2020-07-01',
    });
    expect(toUpdateServicePeriodPayload({ houseId: 'h2', startDate: '2024-01-05', endDate: '' }, open)).toEqual({
      startDate: '2024-01-05',
    });
    expect(toUpdateServicePeriodPayload(servicePeriodFormDefaults(old), old)).toEqual({});
  });
});

describe('regras de @fonte/types (story 216)', () => {
  it('findServicePeriodDatesIssue', () => {
    expect(findServicePeriodDatesIssue({ startDate: '2020-01-01', endDate: '2020-01-01' }, TODAY)).toBeNull();
    expect(findServicePeriodDatesIssue({ startDate: null, endDate: null }, TODAY)).toBeNull();
  });

  it('findServicePeriodOverlap: pontas que se tocam não sobrepõem; ignora o próprio id', () => {
    expect(findServicePeriodOverlap({ startDate: '2020-06-30', endDate: '2024-01-10' }, periods)).toBeNull();
    expect(findServicePeriodOverlap({ id: 'old', startDate: '2020-02-01', endDate: '2020-03-01' }, periods)).toBeNull();
    expect(findServicePeriodOverlap({ startDate: '2025-01-01', endDate: null }, periods)?.id).toBe('open');
  });
});
