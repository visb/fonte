import { describe, expect, it } from 'vitest';
import { FamilyInvestment, Gender, ResidentStatus } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import {
  residentSchema,
  buildResidentPayload,
  residentToFormValues,
  FICHA_FIELDS,
  ADMISSAO_FIELDS,
  type ResidentFormData,
} from './residentSchema';

describe('residentSchema', () => {
  it('exige nome; casa é opcional', () => {
    const res = residentSchema.safeParse({ name: '', houseId: '' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const fields = res.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('name');
      expect(fields).not.toContain('houseId');
    }
  });

  it('aceita ficha mínima válida', () => {
    const res = residentSchema.safeParse({ name: 'João', houseId: 'h1' });
    expect(res.success).toBe(true);
  });

  it('aceita ficha sem casa em qualquer status', () => {
    expect(residentSchema.safeParse({ name: 'João' }).success).toBe(true);
    expect(
      residentSchema.safeParse({ name: 'João', houseId: '', status: ResidentStatus.ACTIVE })
        .success,
    ).toBe(true);
    expect(
      residentSchema.safeParse({ name: 'João', status: ResidentStatus.ARCHIVED }).success,
    ).toBe(true);
  });

  it('rejeita e-mail inválido mas aceita vazio', () => {
    expect(residentSchema.safeParse({ name: 'J', houseId: 'h', email: 'nope' }).success).toBe(false);
    expect(residentSchema.safeParse({ name: 'J', houseId: 'h', email: '' }).success).toBe(true);
    expect(
      residentSchema.safeParse({ name: 'J', houseId: 'h', email: 'a@b.com' }).success,
    ).toBe(true);
  });

  it('coage familyInvestmentAmount: vazio/inválido → null, número → número', () => {
    const blank = residentSchema.parse({ name: 'J', houseId: 'h', familyInvestmentAmount: '' });
    expect(blank.familyInvestmentAmount).toBeNull();
    const bad = residentSchema.parse({ name: 'J', houseId: 'h', familyInvestmentAmount: 'isento' });
    expect(bad.familyInvestmentAmount).toBeNull();
    const ok = residentSchema.parse({ name: 'J', houseId: 'h', familyInvestmentAmount: '300' });
    expect(ok.familyInvestmentAmount).toBe(300);
  });

  it('coage contributionDueDay para string ou undefined', () => {
    expect(residentSchema.parse({ name: 'J', houseId: 'h', contributionDueDay: 10 }).contributionDueDay).toBe('10');
    expect(residentSchema.parse({ name: 'J', houseId: 'h', contributionDueDay: '' }).contributionDueDay).toBeUndefined();
  });

  it('aceita exitDate opcional (import de filho que já saiu, story 120)', () => {
    expect(residentSchema.parse({ name: 'J', houseId: 'h' }).exitDate).toBeUndefined();
    expect(residentSchema.parse({ name: 'J', houseId: 'h', exitDate: '2023-08-10' }).exitDate).toBe('2023-08-10');
  });
});

describe('FICHA_FIELDS / ADMISSAO_FIELDS', () => {
  it('não se sobrepõem e cobrem name/houseId nos grupos certos', () => {
    expect(FICHA_FIELDS).toContain('name');
    expect(ADMISSAO_FIELDS).toContain('houseId');
    const overlap = FICHA_FIELDS.filter((f) => (ADMISSAO_FIELDS as readonly string[]).includes(f));
    expect(overlap).toHaveLength(0);
  });
});

describe('buildResidentPayload', () => {
  it('converte vazio/undefined em null e numéricos em Number', () => {
    const data = {
      name: 'João',
      houseId: 'h1',
      children: '2',
      weight: '80',
      height: '180',
      familyInvestmentAmount: 300,
      contributionDueDay: '10',
      cpf: '',
      rg: undefined,
    } as unknown as ResidentFormData;
    const payload = buildResidentPayload(data);
    expect(payload.name).toBe('João');
    expect(payload.children).toBe(2);
    expect(payload.weight).toBe(80);
    expect(payload.height).toBe(180);
    expect(payload.familyInvestmentAmount).toBe(300);
    expect(payload.contributionDueDay).toBe(10);
    expect(payload.cpf).toBeNull();
    expect(payload.rg).toBeNull();
  });
});

describe('residentToFormValues', () => {
  it('mapeia um Resident para os valores do formulário, mascarando e tratando nulos', () => {
    const resident = {
      name: 'Maria',
      houseId: 'h1',
      status: 'ACTIVE',
      birthDate: '1990-05-01T00:00:00Z',
      cpf: '12345678901',
      rg: null,
      nationality: null,
      gender: Gender.FEMALE,
      email: null,
      children: 3,
      weight: null,
      familyInvestment: FamilyInvestment.SOCIAL,
      familyInvestmentAmount: null,
      contributionDueDay: 5,
      entryDate: null,
      exitDate: '2023-08-10T00:00:00Z',
      contactPhone: '62999998888',
    } as unknown as Resident;
    const values = residentToFormValues(resident);
    expect(values.name).toBe('Maria');
    expect(values.birthDate).toBe('1990-05-01');
    expect(values.cpf).toBe('123.456.789-01');
    expect(values.rg).toBe('');
    expect(values.children).toBe('3');
    expect(values.weight).toBe('');
    expect(values.contributionDueDay).toBe('5');
    expect(values.entryDate).toBe('');
    expect(values.exitDate).toBe('2023-08-10');
    expect(values.gender).toBe(Gender.FEMALE);
  });

  it('mapeia exitDate ausente para string vazia', () => {
    const resident = { name: 'Ana', houseId: 'h1', status: 'ACTIVE', exitDate: null } as unknown as Resident;
    expect(residentToFormValues(resident).exitDate).toBe('');
  });
});
