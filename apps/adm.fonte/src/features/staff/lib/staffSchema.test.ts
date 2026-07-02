import { describe, expect, it } from 'vitest';
import { Role, ServantRank } from '@fonte/types';
import type { Staff } from '@fonte/api-client';
import {
  newStaffSchema,
  editStaffSchema,
  buildStaffPayload,
  staffToFormValues,
  staffTabsWithError,
  STAFF_TAB_FIELDS,
  type NewStaffFormData,
} from './staffSchema';

const baseValid: NewStaffFormData = {
  name: 'Pedro',
  email: '',
  role: Role.SERVANT,
  rank: ServantRank.ASPIRANTE,
  servesInGroup: false,
  houseId: 'h1',
  supportGroupId: '',
  password: 'secret',
} as NewStaffFormData;

describe('newStaffSchema', () => {
  it('aceita servo da casa com houseId', () => {
    expect(newStaffSchema.safeParse(baseValid).success).toBe(true);
  });

  it('exige senha com no mínimo 6 caracteres', () => {
    expect(newStaffSchema.safeParse({ ...baseValid, password: '123' }).success).toBe(false);
  });

  it('exige houseId quando não serve em grupo', () => {
    const res = newStaffSchema.safeParse({ ...baseValid, houseId: '' });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues.some((i) => i.path.includes('houseId'))).toBe(true);
  });

  it('exige supportGroupId quando serve em grupo', () => {
    const res = newStaffSchema.safeParse({
      ...baseValid,
      servesInGroup: true,
      houseId: '',
      supportGroupId: '',
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues.some((i) => i.path.includes('supportGroupId'))).toBe(true);
  });

  it('aceita servo de grupo com supportGroupId', () => {
    expect(
      newStaffSchema.safeParse({
        ...baseValid,
        servesInGroup: true,
        houseId: '',
        supportGroupId: 'g1',
      }).success,
    ).toBe(true);
  });

  // Story 96 — só a aba Sistema tem obrigatórios: salvar com as abas Pessoal e
  // Endereço/Contato 100% vazias é válido.
  it('aceita cadastro só com a aba Sistema preenchida (Pessoal e Endereço vazias)', () => {
    const res = newStaffSchema.safeParse({
      ...baseValid,
      cpf: '',
      rg: '',
      nationality: '',
      birthDate: '',
      gender: '',
      maritalStatus: '',
      children: '',
      occupation: '',
      education: '',
      religion: '',
      address: '',
      city: '',
      state: '',
      contactPhone: '',
    });
    expect(res.success).toBe(true);
  });

  // Story 96 — os campos clínicos/de tratamento não existem mais no schema:
  // valores enviados nessas chaves são descartados no parse.
  it('campos clínicos removidos não existem no schema', () => {
    const parsed = newStaffSchema.parse({
      ...baseValid,
      addiction: 'Álcool',
      healthIssues: 'Hipertensão',
      continuousMedication: 'Losartana',
      weight: '70',
      height: '175',
    } as never);
    expect(parsed).not.toHaveProperty('addiction');
    expect(parsed).not.toHaveProperty('healthIssues');
    expect(parsed).not.toHaveProperty('continuousMedication');
    expect(parsed).not.toHaveProperty('weight');
    expect(parsed).not.toHaveProperty('height');
    const allTabFields = Object.values(STAFF_TAB_FIELDS).flat() as string[];
    for (const removed of ['addiction', 'healthIssues', 'continuousMedication', 'weight', 'height']) {
      expect(allTabFields).not.toContain(removed);
    }
  });
});

describe('staffTabsWithError', () => {
  it('sinaliza só a aba Sistema para erro em campo de sistema', () => {
    expect(staffTabsWithError(['name', 'houseId'])).toEqual({
      system: true,
      personal: false,
      address: false,
    });
  });

  it('sinaliza abas Pessoal e Endereço para erros nos seus campos', () => {
    expect(staffTabsWithError(['cpf', 'city'])).toEqual({
      system: false,
      personal: true,
      address: true,
    });
  });

  it('sem erros, nenhuma aba é sinalizada', () => {
    expect(staffTabsWithError([])).toEqual({ system: false, personal: false, address: false });
  });
});

describe('editStaffSchema', () => {
  it('não exige senha', () => {
    const { password, ...noPwd } = baseValid;
    void password;
    expect(editStaffSchema.safeParse(noPwd).success).toBe(true);
  });
});

describe('buildStaffPayload', () => {
  it('servo da casa: houseId preenchido, supportGroupId nulo, rank padrão', () => {
    const payload = buildStaffPayload(baseValid);
    expect(payload.houseId).toBe('h1');
    expect(payload.supportGroupId).toBeNull();
    expect(payload.rank).toBe(ServantRank.ASPIRANTE);
    expect(payload.children).toBe(0);
  });

  it('servo de grupo: supportGroupId preenchido, houseId nulo', () => {
    const payload = buildStaffPayload({
      ...baseValid,
      servesInGroup: true,
      houseId: '',
      supportGroupId: 'g1',
    });
    expect(payload.houseId).toBeNull();
    expect(payload.supportGroupId).toBe('g1');
  });

  it('papel não-servo não recebe rank', () => {
    const payload = buildStaffPayload({ ...baseValid, role: Role.ADMIN });
    expect(payload.rank).toBeNull();
  });

  it('strings vazias viram null e numéricos são convertidos', () => {
    const payload = buildStaffPayload({ ...baseValid, children: '2', cpf: '   ' });
    expect(payload.children).toBe(2);
    expect(payload.cpf).toBeNull();
  });

  // Story 96 — o payload enviado à API não carrega mais campos de tratamento.
  it('payload não contém campos clínicos removidos', () => {
    const payload = buildStaffPayload(baseValid);
    expect(payload).not.toHaveProperty('addiction');
    expect(payload).not.toHaveProperty('healthIssues');
    expect(payload).not.toHaveProperty('continuousMedication');
    expect(payload).not.toHaveProperty('weight');
    expect(payload).not.toHaveProperty('height');
  });
});

describe('staffToFormValues', () => {
  it('servo sem casa é tratado como servo de grupo', () => {
    const staff = {
      name: 'Ana',
      houseId: null,
      supportGroupId: 'g1',
      rank: ServantRank.ASPIRANTE,
      user: { email: 'ana@x.com', role: Role.SERVANT },
      cpf: '12345678901',
      phone: '62999998888',
      children: 0,
      birthDate: '1990-01-01T00:00:00Z',
    } as unknown as Staff;
    const values = staffToFormValues(staff);
    expect(values.servesInGroup).toBe(true);
    expect(values.supportGroupId).toBe('g1');
    expect(values.cpf).toBe('123.456.789-01');
    expect(values.email).toBe('ana@x.com');
    expect(values.birthDate).toBe('1990-01-01');
  });

  it('servo com casa não serve em grupo', () => {
    const staff = {
      name: 'Bia',
      houseId: 'h1',
      supportGroupId: null,
      rank: null,
      user: { email: null, role: Role.SERVANT },
      children: 2,
    } as unknown as Staff;
    const values = staffToFormValues(staff);
    expect(values.servesInGroup).toBe(false);
    expect(values.houseId).toBe('h1');
    expect(values.email).toBe('');
    expect(values.children).toBe('2');
    expect(values.rank).toBe(ServantRank.ASPIRANTE);
  });
});
