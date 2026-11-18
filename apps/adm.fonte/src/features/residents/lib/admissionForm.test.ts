import { describe, expect, it } from 'vitest';
import {
  ADMISSION_DATE_MESSAGES,
  ADMISSION_HISTORY_MESSAGES,
  findAdmissionOverlap,
  ResidentStatus,
} from '@fonte/types';
import type { Admission } from '@fonte/api-client';
import {
  admissionEditableFields,
  admissionFormDefaults,
  makeAdmissionFormSchema,
  toCreateAdmissionPayload,
  toUpdateAdmissionPayload,
  type AdmissionFormValues,
} from './admissionForm';

const TODAY = '2026-10-20';

function admission(overrides: Partial<Admission>): Admission {
  return {
    id: 'a',
    residentId: 'r1',
    houseId: 'h1',
    house: { id: 'h1', name: 'Casa' },
    status: ResidentStatus.DISCHARGED,
    entryDate: '2020-01-01',
    exitDate: '2020-06-30',
    ...overrides,
  } as Admission;
}

const current = admission({ id: 'cur', entryDate: '2024-01-10', exitDate: null, status: ResidentStatus.ACTIVE });
const old = admission({ id: 'old' });
const admissions = [current, old];

const values = (overrides: Partial<AdmissionFormValues> = {}): AdmissionFormValues => ({
  houseId: 'h1',
  entryDate: '2021-03-01',
  exitDate: '2021-09-01',
  status: ResidentStatus.EVADED,
  ...overrides,
});

function messages(result: ReturnType<ReturnType<typeof makeAdmissionFormSchema>['safeParse']>) {
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
}

describe('makeAdmissionFormSchema — criar', () => {
  const schema = makeAdmissionFormSchema({ mode: 'create', admissions, today: TODAY });

  it('passagem encerrada válida passa', () => {
    expect(schema.safeParse(values()).success).toBe(true);
  });

  it('saída obrigatória, entrada obrigatória, status de saída obrigatório', () => {
    expect(messages(schema.safeParse(values({ exitDate: '' })))).toMatchObject({
      exitDate: ADMISSION_HISTORY_MESSAGES.exitDateRequired,
    });
    expect(messages(schema.safeParse(values({ entryDate: '' })))).toMatchObject({
      entryDate: 'Informe a data de entrada.',
    });
    expect(messages(schema.safeParse(values({ status: ResidentStatus.ACTIVE })))).toMatchObject({
      status: ADMISSION_HISTORY_MESSAGES.exitStatusRequired,
    });
  });

  it('casa só pode faltar em ARCHIVED', () => {
    expect(messages(schema.safeParse(values({ houseId: '' })))).toMatchObject({
      houseId: ADMISSION_HISTORY_MESSAGES.houseRequired,
    });
    expect(schema.safeParse(values({ houseId: '', status: ResidentStatus.ARCHIVED })).success).toBe(true);
  });

  it('datas da story 203', () => {
    expect(messages(schema.safeParse(values({ exitDate: '2021-01-01' })))).toMatchObject({
      exitDate: ADMISSION_DATE_MESSAGES.exitBeforeEntry('2021-03-01'),
    });
    expect(messages(schema.safeParse(values({ exitDate: '2026-12-01' })))).toMatchObject({
      exitDate: ADMISSION_DATE_MESSAGES.exitFuture,
    });
  });

  it('sobreposição e "depois do atual" vão para a entrada', () => {
    expect(messages(schema.safeParse(values({ entryDate: '2020-05-01', exitDate: '2020-12-01' })))).toMatchObject({
      entryDate: ADMISSION_HISTORY_MESSAGES.overlap('2020-01-01', '2020-06-30'),
    });
    expect(messages(schema.safeParse(values({ entryDate: '2024-02-01', exitDate: '2024-03-01' })))).toMatchObject({
      entryDate: ADMISSION_HISTORY_MESSAGES.afterCurrent('2024-01-10'),
    });
  });
});

describe('makeAdmissionFormSchema — editar encerrada', () => {
  const schema = makeAdmissionFormSchema({ mode: 'edit', admission: old, admissions, today: TODAY });

  it('a própria passagem não conta como sobreposição', () => {
    expect(schema.safeParse(admissionFormDefaults(old)).success).toBe(true);
    expect(schema.safeParse({ ...admissionFormDefaults(old), exitDate: '2020-06-01' }).success).toBe(true);
  });

  it('sobrepor o atual → erro', () => {
    expect(messages(schema.safeParse({ ...admissionFormDefaults(old), exitDate: '2024-02-01' }))).toMatchObject({
      entryDate: ADMISSION_HISTORY_MESSAGES.overlap('2024-01-10', null),
    });
  });
});

describe('makeAdmissionFormSchema — acolhimento atual', () => {
  const schema = makeAdmissionFormSchema({ mode: 'current', admission: current, admissions, today: TODAY });

  it('só a entrada é julgada (saída/status ficam de fora)', () => {
    expect(schema.safeParse({ ...admissionFormDefaults(current), entryDate: '2024-01-05' }).success).toBe(true);
  });

  it('entrada futura ou sobrepondo a anterior → erro', () => {
    expect(messages(schema.safeParse({ ...admissionFormDefaults(current), entryDate: '2026-12-01' }))).toMatchObject({
      entryDate: ADMISSION_DATE_MESSAGES.entryFuture,
    });
    expect(messages(schema.safeParse({ ...admissionFormDefaults(current), entryDate: '2020-03-01' }))).toMatchObject({
      entryDate: ADMISSION_HISTORY_MESSAGES.overlap('2020-01-01', '2020-06-30'),
    });
  });
});

describe('makeAdmissionFormSchema — acolhimento atual encerrado', () => {
  const closed = admission({ id: 'cur', entryDate: '2024-01-10', exitDate: '2024-05-01' });
  const schema = makeAdmissionFormSchema({ mode: 'current', admission: closed, admissions: [closed, old], today: TODAY });

  it('saída editável e julgada; status/casa não', () => {
    expect(admissionEditableFields('current', closed)).toBe('dates');
    expect(admissionEditableFields('current', current)).toBe('entry');
    expect(schema.safeParse({ ...admissionFormDefaults(closed), exitDate: '2024-04-20', status: '' }).success).toBe(true);
    expect(messages(schema.safeParse({ ...admissionFormDefaults(closed), exitDate: '' }))).toMatchObject({
      exitDate: ADMISSION_HISTORY_MESSAGES.exitDateRequired,
    });
    expect(messages(schema.safeParse({ ...admissionFormDefaults(closed), exitDate: '2024-01-01' }))).toMatchObject({
      exitDate: ADMISSION_DATE_MESSAGES.exitBeforeEntry('2024-01-10'),
    });
  });
});

describe('makeAdmissionFormSchema — atual sem saída, filho fora do acolhimento', () => {
  const archived = admission({ id: 'cur', entryDate: '2024-01-10', exitDate: null, status: ResidentStatus.ARCHIVED });
  const schema = makeAdmissionFormSchema({ mode: 'current', admission: archived, admissions: [archived], today: TODAY });

  it('libera a saída, opcional; quando informada é julgada', () => {
    expect(admissionEditableFields('current', archived)).toBe('dates');
    expect(schema.safeParse(admissionFormDefaults(archived)).success).toBe(true);
    expect(schema.safeParse({ ...admissionFormDefaults(archived), exitDate: '2024-03-01' }).success).toBe(true);
    expect(messages(schema.safeParse({ ...admissionFormDefaults(archived), exitDate: '2024-01-01' }))).toMatchObject({
      exitDate: ADMISSION_DATE_MESSAGES.exitBeforeEntry('2024-01-10'),
    });
    expect(
      toUpdateAdmissionPayload({ ...admissionFormDefaults(archived), exitDate: '2024-03-01' }, archived, 'current'),
    ).toEqual({ exitDate: '2024-03-01' });
  });
});

describe('payloads', () => {
  it('criar converte casa vazia em null', () => {
    expect(toCreateAdmissionPayload(values({ houseId: '' }))).toEqual({
      houseId: null,
      entryDate: '2021-03-01',
      exitDate: '2021-09-01',
      status: ResidentStatus.EVADED,
    });
  });

  it('editar manda só o que mudou; no atual só a entrada', () => {
    const base = admissionFormDefaults(old);
    expect(toUpdateAdmissionPayload(base, old, 'edit')).toEqual({});
    expect(
      toUpdateAdmissionPayload({ ...base, houseId: '', exitDate: '2020-05-01', status: ResidentStatus.ARCHIVED }, old, 'edit'),
    ).toEqual({ houseId: null, exitDate: '2020-05-01', status: ResidentStatus.ARCHIVED });
    expect(
      toUpdateAdmissionPayload({ ...admissionFormDefaults(current), entryDate: '2024-01-05', houseId: 'h2' }, current, 'current'),
    ).toEqual({ entryDate: '2024-01-05' });
  });

  it('atual encerrado manda a saída, nunca casa/status', () => {
    const closed = admission({ id: 'cur', entryDate: '2024-01-10', exitDate: '2024-05-01' });
    expect(
      toUpdateAdmissionPayload(
        { ...admissionFormDefaults(closed), exitDate: '2024-04-20', houseId: 'h2', status: ResidentStatus.EVADED },
        closed,
        'current',
      ),
    ).toEqual({ exitDate: '2024-04-20' });
  });

  it('status legado não terminal começa vazio no form', () => {
    expect(admissionFormDefaults(admission({ status: ResidentStatus.ACTIVE })).status).toBe('');
    expect(admissionFormDefaults(null)).toEqual({ houseId: '', entryDate: '', exitDate: '', status: '' });
  });
});

describe('findAdmissionOverlap (@fonte/types)', () => {
  const others = [
    { id: 'x', entryDate: '2020-01-01', exitDate: '2020-06-30' },
    { id: 'legacy', entryDate: null, exitDate: '2019-01-01' },
  ];

  it('encostar na saída não é sobreposição; cruzar é', () => {
    expect(findAdmissionOverlap({ entryDate: '2020-06-30', exitDate: '2020-08-01' }, others)).toBeNull();
    expect(findAdmissionOverlap({ entryDate: '2019-01-01', exitDate: '2020-01-01' }, others)).toBeNull();
    expect(findAdmissionOverlap({ entryDate: '2019-01-01', exitDate: '2020-01-02' }, others)?.id).toBe('x');
  });

  it('sem entrada não julga; passagem aberta vai até sempre', () => {
    expect(findAdmissionOverlap({ entryDate: null, exitDate: '2020-03-01' }, others)).toBeNull();
    expect(findAdmissionOverlap({ entryDate: '2019-06-01', exitDate: null }, others)?.id).toBe('x');
    expect(findAdmissionOverlap({ id: 'x', entryDate: '2020-02-01', exitDate: '2020-03-01' }, others)).toBeNull();
  });
});
