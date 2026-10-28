import { IncidentSeverity } from '@fonte/types';
import { DATE_FIELD_MESSAGES } from '@/lib/date';
import { incidentFormDefaults, incidentFormSchema } from './schema';

describe('incidentFormSchema (story 226, relógio mockado)', () => {
  afterEach(() => jest.useRealTimers());

  const base = { severity: IncidentSeverity.MEDIUM, description: 'Algo', residentId: '' };

  function dateMessage(date: string) {
    const result = incidentFormSchema.safeParse({ ...base, date });
    if (result.success) return null;
    return result.error.issues.find((issue) => issue.path[0] === 'date')?.message ?? null;
  }

  it('hoje e passada passam', () => {
    jest.useFakeTimers({ now: new Date('2026-10-28T15:00:00Z') });
    expect(dateMessage('2026-10-28')).toBeNull();
    expect(dateMessage('2025-01-01')).toBeNull();
  });

  it('vazia (texto inválido/incompleto chega vazio do DateInput) pede data', () => {
    expect(dateMessage('')).toBe(DATE_FIELD_MESSAGES.required);
  });

  it('futura é rejeitada', () => {
    jest.useFakeTimers({ now: new Date('2026-10-28T15:00:00Z') });
    expect(dateMessage('2026-10-29')).toBe(DATE_FIELD_MESSAGES.future);
  });

  it('descrição vazia segue exigida', () => {
    const result = incidentFormSchema.safeParse({ ...base, description: '', date: '2025-01-01' });
    expect(result.success).toBe(false);
  });

  describe('incidentFormDefaults: hoje no fuso local', () => {
    it('de dia, data local = data UTC', () => {
      jest.useFakeTimers({ now: new Date('2026-10-28T15:00:00Z') });
      expect(incidentFormDefaults()).toEqual({
        date: '2026-10-28',
        severity: IncidentSeverity.MEDIUM,
        description: '',
        residentId: '',
      });
    });

    it('virada 21h BRT: 22h do dia 28 em São Paulo ainda é 28 (toISOString daria 29)', () => {
      // 01:00 UTC do dia 29 = 22:00 do dia 28 em São Paulo.
      jest.useFakeTimers({ now: new Date('2026-10-29T01:00:00Z') });
      expect(new Date().toISOString().split('T')[0]).toBe('2026-10-29');
      expect(incidentFormDefaults().date).toBe('2026-10-28');
      // E o default passa no schema — não nasce "futuro".
      expect(dateMessage(incidentFormDefaults().date)).toBeNull();
    });
  });
});
