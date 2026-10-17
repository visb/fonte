import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMISSION_DRAFT_TTL_MS,
  ADMISSION_DRAFT_VERSION,
  admissionDraftKey,
  clearAdmissionDraft,
  clearUserAdmissionDrafts,
  formatDraftDateTime,
  formatDraftTime,
  readAdmissionDraft,
  writeAdmissionDraft,
  type AdmissionDraftData,
} from './admissionDraft';

const data: AdmissionDraftData<{ name: string }> = {
  values: { name: 'Fulano' },
  step: 1,
  residentId: null,
  firstPaymentPaid: true,
  firstPaymentMethod: 'PIX',
  hadPhoto: true,
  hadProof: false,
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('admissionDraftKey', () => {
  it('primeiro acolhimento por usuário; reintrodução por usuário + filho', () => {
    expect(admissionDraftKey('u1')).toBe('fonte:admission-draft:u1');
    expect(admissionDraftKey('u1', 'r9')).toBe('fonte:admission-draft:u1:readmission:r9');
  });
});

describe('write/read', () => {
  it('grava e lê pela chave do usuário; outro usuário não lê', () => {
    const savedAt = writeAdmissionDraft(admissionDraftKey('u1'), data);
    expect(savedAt).not.toBeNull();
    const draft = readAdmissionDraft<{ name: string }>(admissionDraftKey('u1'));
    expect(draft).toMatchObject({ ...data, version: ADMISSION_DRAFT_VERSION, savedAt });
    expect(readAdmissionDraft(admissionDraftKey('u2'))).toBeNull();
  });

  it('rascunho com mais de 7 dias é descartado na leitura', () => {
    const key = admissionDraftKey('u1');
    const savedAt = new Date('2026-10-01T12:00:00Z');
    writeAdmissionDraft(key, data, savedAt);
    const within = savedAt.getTime() + ADMISSION_DRAFT_TTL_MS;
    expect(readAdmissionDraft(key, within)).not.toBeNull();
    expect(readAdmissionDraft(key, within + 1)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('versão diferente é descartada', () => {
    const key = admissionDraftKey('u1');
    localStorage.setItem(key, JSON.stringify({ ...data, version: 999, savedAt: new Date().toISOString() }));
    expect(readAdmissionDraft(key)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('savedAt inválido ou sem values é descartado', () => {
    const key = admissionDraftKey('u1');
    localStorage.setItem(key, JSON.stringify({ ...data, version: ADMISSION_DRAFT_VERSION, savedAt: 'ontem' }));
    expect(readAdmissionDraft(key)).toBeNull();
    localStorage.setItem(key, JSON.stringify({ version: ADMISSION_DRAFT_VERSION, savedAt: new Date().toISOString() }));
    expect(readAdmissionDraft(key)).toBeNull();
    localStorage.setItem(key, 'null');
    expect(readAdmissionDraft(key)).toBeNull();
  });

  it('campos ausentes ganham defaults seguros', () => {
    const key = admissionDraftKey('u1');
    localStorage.setItem(
      key,
      JSON.stringify({ version: ADMISSION_DRAFT_VERSION, savedAt: new Date().toISOString(), values: { name: 'X' } }),
    );
    expect(readAdmissionDraft(key)).toMatchObject({
      step: 0,
      residentId: null,
      firstPaymentPaid: false,
      firstPaymentMethod: '',
      hadPhoto: false,
      hadProof: false,
    });
  });

  it('JSON corrompido → sem rascunho, sem erro, e a chave é limpa', () => {
    const key = admissionDraftKey('u1');
    localStorage.setItem(key, '{não é json');
    expect(readAdmissionDraft(key)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('localStorage lançando exceção → sem rascunho, sem erro', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const key = admissionDraftKey('u1');
    expect(readAdmissionDraft(key)).toBeNull();
    expect(writeAdmissionDraft(key, data)).toBeNull();
    expect(() => clearAdmissionDraft(key)).not.toThrow();
    expect(() => clearUserAdmissionDrafts('u1')).not.toThrow();
  });
});

describe('clear', () => {
  it('clearAdmissionDraft remove a chave', () => {
    const key = admissionDraftKey('u1');
    writeAdmissionDraft(key, data);
    clearAdmissionDraft(key);
    expect(readAdmissionDraft(key)).toBeNull();
  });

  it('clearUserAdmissionDrafts remove só os rascunhos do usuário', () => {
    writeAdmissionDraft(admissionDraftKey('u1'), data);
    writeAdmissionDraft(admissionDraftKey('u1', 'r1'), data);
    writeAdmissionDraft(admissionDraftKey('u10'), data);
    writeAdmissionDraft(admissionDraftKey('u2'), data);
    localStorage.setItem('fonte_token', 'x');
    clearUserAdmissionDrafts('u1');
    expect(localStorage.getItem(admissionDraftKey('u1'))).toBeNull();
    expect(localStorage.getItem(admissionDraftKey('u1', 'r1'))).toBeNull();
    expect(localStorage.getItem(admissionDraftKey('u10'))).not.toBeNull();
    expect(localStorage.getItem(admissionDraftKey('u2'))).not.toBeNull();
    expect(localStorage.getItem('fonte_token')).toBe('x');
  });

  it('clearUserAdmissionDrafts sem usuário não faz nada', () => {
    writeAdmissionDraft(admissionDraftKey('u1'), data);
    clearUserAdmissionDrafts(null);
    clearUserAdmissionDrafts(undefined);
    expect(localStorage.getItem(admissionDraftKey('u1'))).not.toBeNull();
  });
});

describe('formatação', () => {
  it('data/hora no fuso de São Paulo', () => {
    expect(formatDraftTime('2026-10-17T17:05:00Z')).toBe('14:05');
    expect(formatDraftDateTime('2026-10-17T17:05:00Z')).toBe('17/10/2026 14:05');
  });
});
