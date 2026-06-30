import { describe, expect, it } from 'vitest';
import { EventAudience } from '@fonte/api-client';
import {
  eventSchema,
  registrationFieldSchema,
  toEventInput,
  toRegistrationFields,
  fieldsToForm,
  type EventFormData,
} from './eventSchema';

const base = {
  title: 'Retiro',
  description: 'Encontro',
  startAt: '2026-08-01T18:00',
};

describe('eventSchema', () => {
  it('aceita um evento mínimo válido (sem fim/capacidade/inscrição)', () => {
    const result = eventSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('aceita capacity vazio como ilimitado (undefined)', () => {
    const result = eventSchema.safeParse({ ...base, capacity: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.capacity).toBeUndefined();
  });

  it('rejeita endAt anterior a startAt', () => {
    const result = eventSchema.safeParse({
      ...base,
      endAt: '2026-07-31T18:00',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('endAt'))).toBe(true);
    }
  });

  it('aceita endAt igual ou posterior a startAt', () => {
    expect(eventSchema.safeParse({ ...base, endAt: '2026-08-01T20:00' }).success).toBe(true);
  });

  it('rejeita janela de inscrição incoerente quando inscrição habilitada', () => {
    const result = eventSchema.safeParse({
      ...base,
      registrationEnabled: true,
      registrationOpensAt: '2026-07-20T00:00',
      registrationClosesAt: '2026-07-10T00:00',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes('registrationClosesAt')),
      ).toBe(true);
    }
  });

  it('ignora a janela incoerente quando inscrição desligada (só-divulgação)', () => {
    const result = eventSchema.safeParse({
      ...base,
      registrationEnabled: false,
      registrationOpensAt: '2026-07-20T00:00',
      registrationClosesAt: '2026-07-10T00:00',
    });
    expect(result.success).toBe(true);
  });

  it('registrationEnabled default é false (só-divulgação)', () => {
    const result = eventSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.registrationEnabled).toBe(false);
  });

  it('audience default é PUBLIC (story 94)', () => {
    const result = eventSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.audience).toBe(EventAudience.PUBLIC);
  });

  it('aceita audience INTERNAL (story 94)', () => {
    const result = eventSchema.safeParse({ ...base, audience: EventAudience.INTERNAL });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.audience).toBe(EventAudience.INTERNAL);
  });

  it('rejeita título vazio', () => {
    expect(eventSchema.safeParse({ ...base, title: '' }).success).toBe(false);
  });

  it('rejeita capacity zero ou negativo', () => {
    expect(eventSchema.safeParse({ ...base, capacity: '0' }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, capacity: '-3' }).success).toBe(false);
  });
});

describe('toEventInput', () => {
  const baseForm: EventFormData = {
    title: 'Retiro',
    description: 'Encontro',
    startAt: '2026-08-01T18:00',
    endAt: '',
    location: '',
    audience: EventAudience.PUBLIC,
    capacity: undefined,
    registrationEnabled: false,
    paymentEnabled: false,
    priceReais: undefined,
    registrationFields: [],
    registrationOpensAt: '',
    registrationClosesAt: '',
  };

  it('evento PUBLIC propaga a audiência (story 94)', () => {
    const input = toEventInput({ ...baseForm, audience: EventAudience.PUBLIC });
    expect(input.audience).toBe(EventAudience.PUBLIC);
  });

  it('evento INTERNAL força inscrição/cobrança off (story 94)', () => {
    const input = toEventInput({
      ...baseForm,
      audience: EventAudience.INTERNAL,
      registrationEnabled: true,
      paymentEnabled: true,
      priceReais: 50,
      capacity: 30,
    });
    expect(input.audience).toBe(EventAudience.INTERNAL);
    expect(input.registrationEnabled).toBe(false);
    expect(input.paymentEnabled).toBe(false);
    expect(input.priceCents).toBeNull();
    expect(input.capacity).toBeNull();
    expect(input.registrationFields).toEqual([]);
  });

  it('com inscrição desligada, zera capacidade e janela', () => {
    const input = toEventInput({
      ...baseForm,
      registrationEnabled: false,
      capacity: 50,
      registrationOpensAt: '2026-07-01T00:00',
      registrationClosesAt: '2026-07-20T00:00',
    });
    expect(input.registrationEnabled).toBe(false);
    expect(input.capacity).toBeNull();
    expect(input.registrationOpensAt).toBeNull();
    expect(input.registrationClosesAt).toBeNull();
  });

  it('com inscrição ligada, propaga capacidade e janela', () => {
    const input = toEventInput({
      ...baseForm,
      registrationEnabled: true,
      capacity: 50,
      registrationOpensAt: '2026-07-01T00:00',
      registrationClosesAt: '2026-07-20T00:00',
    });
    expect(input.registrationEnabled).toBe(true);
    expect(input.capacity).toBe(50);
    expect(input.registrationOpensAt).not.toBeNull();
    expect(input.registrationClosesAt).not.toBeNull();
  });

  it('com inscrição ligada, propaga os campos custom (story 68)', () => {
    const input = toEventInput({
      ...baseForm,
      registrationEnabled: true,
      registrationFields: [
        { label: 'Tamanho', type: 'select', required: true, optionsText: 'P\nM\nG' },
        { label: 'Obs', type: 'long_text', required: false, optionsText: '' },
      ],
    });
    expect(input.registrationFields).toHaveLength(2);
    expect(input.registrationFields![0].options).toEqual(['P', 'M', 'G']);
    expect(input.registrationFields![1].options).toBeUndefined();
    // Sem id → backend gera; a chave não é enviada.
    expect(input.registrationFields![0]).not.toHaveProperty('id');
  });

  it('com inscrição desligada, zera os campos custom', () => {
    const input = toEventInput({
      ...baseForm,
      registrationEnabled: false,
      registrationFields: [
        { label: 'Tamanho', type: 'select', required: true, optionsText: 'P\nM' },
      ],
    });
    expect(input.registrationFields).toEqual([]);
  });

  // ── Pagamento (story 69) ───────────────────────────────────────────────────

  it('inscrição paga: converte reais → centavos', () => {
    const input = toEventInput({
      ...baseForm,
      registrationEnabled: true,
      paymentEnabled: true,
      priceReais: 50,
    });
    expect(input.paymentEnabled).toBe(true);
    expect(input.priceCents).toBe(5000);
  });

  it('inscrição grátis: paymentEnabled false e priceCents null', () => {
    const input = toEventInput({
      ...baseForm,
      registrationEnabled: true,
      paymentEnabled: false,
      priceReais: 50,
    });
    expect(input.paymentEnabled).toBe(false);
    expect(input.priceCents).toBeNull();
  });

  it('inscrição desligada anula a cobrança', () => {
    const input = toEventInput({
      ...baseForm,
      registrationEnabled: false,
      paymentEnabled: true,
      priceReais: 50,
    });
    expect(input.paymentEnabled).toBe(false);
    expect(input.priceCents).toBeNull();
  });
});

describe('eventSchema — pagamento (story 69)', () => {
  it('rejeita inscrição paga sem valor', () => {
    const result = eventSchema.safeParse({
      ...base,
      registrationEnabled: true,
      paymentEnabled: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('priceReais'))).toBe(true);
    }
  });

  it('aceita inscrição paga com valor positivo', () => {
    const result = eventSchema.safeParse({
      ...base,
      registrationEnabled: true,
      paymentEnabled: true,
      priceReais: '50',
    });
    expect(result.success).toBe(true);
  });

  it('ignora o valor quando a cobrança está desligada', () => {
    const result = eventSchema.safeParse({
      ...base,
      registrationEnabled: true,
      paymentEnabled: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('registrationFieldSchema (story 68)', () => {
  it('exige rótulo', () => {
    const r = registrationFieldSchema.safeParse({ label: '', type: 'short_text' });
    expect(r.success).toBe(false);
  });

  it('select exige ao menos uma opção', () => {
    const r = registrationFieldSchema.safeParse({
      label: 'Tamanho',
      type: 'select',
      optionsText: '   \n  ',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('optionsText'))).toBe(true);
    }
  });

  it('select com opções é válido', () => {
    const r = registrationFieldSchema.safeParse({
      label: 'Tamanho',
      type: 'select',
      optionsText: 'P\nM',
    });
    expect(r.success).toBe(true);
  });

  it('campo sem options (texto) é válido sem optionsText', () => {
    const r = registrationFieldSchema.safeParse({ label: 'Nome', type: 'short_text' });
    expect(r.success).toBe(true);
  });
});

describe('fieldsToForm / toRegistrationFields round-trip', () => {
  it('converte options ↔ optionsText', () => {
    const form = fieldsToForm([
      { id: 'shirt', label: 'Tamanho', type: 'select', required: true, order: 0, options: ['P', 'M'] },
    ]);
    expect(form[0].optionsText).toBe('P\nM');

    const back = toRegistrationFields(form);
    expect(back[0].id).toBe('shirt');
    expect(back[0].options).toEqual(['P', 'M']);
  });
});
