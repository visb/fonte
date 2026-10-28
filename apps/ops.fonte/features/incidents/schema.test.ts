import { IncidentType } from '@fonte/types';
import { DATE_FIELD_MESSAGES } from '@/lib/date';
import { INCIDENT_TYPE_REQUIRED_MESSAGE, incidentFormDefaults, incidentFormSchema } from './schema';

describe('incidentFormSchema (story 226, relógio mockado)', () => {
  afterEach(() => jest.useRealTimers());

  const base = { type: IncidentType.NEGATIVE, description: 'Algo', residentIds: [] };

  // Story 229: tipo obrigatório, sem default.
  describe('type', () => {
    function typeMessage(type: unknown) {
      const result = incidentFormSchema.safeParse({ ...base, date: '2025-01-01', type });
      if (result.success) return null;
      return result.error.issues.find((issue) => issue.path[0] === 'type')?.message ?? null;
    }

    it('POSITIVE e NEGATIVE passam', () => {
      expect(typeMessage(IncidentType.POSITIVE)).toBeNull();
      expect(typeMessage(IncidentType.NEGATIVE)).toBeNull();
    });

    it('ausente ou inválido pede a escolha', () => {
      expect(typeMessage(undefined)).toBe(INCIDENT_TYPE_REQUIRED_MESSAGE);
      expect(typeMessage('MEDIUM')).toBe(INCIDENT_TYPE_REQUIRED_MESSAGE);
    });
  });

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

  it('residentIds aceita vazio e N filhos (story 227)', () => {
    expect(incidentFormSchema.safeParse({ ...base, date: '2025-01-01' }).success).toBe(true);
    expect(
      incidentFormSchema.safeParse({ ...base, date: '2025-01-01', residentIds: ['r1', 'r2'] }).success,
    ).toBe(true);
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
        type: undefined,
        description: '',
        residentIds: [],
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
