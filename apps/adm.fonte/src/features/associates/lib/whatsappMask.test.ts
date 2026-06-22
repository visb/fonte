import { describe, expect, it } from 'vitest';
import { formatWhatsapp, toE164 } from './whatsappMask';

describe('formatWhatsapp', () => {
  it('vazio retorna vazio', () => {
    expect(formatWhatsapp('')).toBe('');
    expect(formatWhatsapp('abc')).toBe('');
  });

  it('formata celular completo a partir de E.164', () => {
    expect(formatWhatsapp('+5562999998888')).toBe('+55 (62) 99999-8888');
  });

  it('remove o DDI 55 quando o número BR está completo', () => {
    expect(formatWhatsapp('5562999998888')).toBe('+55 (62) 99999-8888');
  });

  it('formata fixo (8 dígitos) com quebra em 4', () => {
    expect(formatWhatsapp('6233334444')).toBe('+55 (62) 3333-4444');
  });

  it('tolera digitação incompleta', () => {
    expect(formatWhatsapp('6')).toBe('+55 (6');
    expect(formatWhatsapp('62')).toBe('+55 (62)');
    expect(formatWhatsapp('629')).toBe('+55 (62) 9');
  });
});

describe('toE164', () => {
  it('converte mascarado/digitado para E.164', () => {
    expect(toE164('+55 (62) 99999-8888')).toBe('+5562999998888');
    expect(toE164('62999998888')).toBe('+5562999998888');
  });

  it('vazio retorna vazio', () => {
    expect(toE164('')).toBe('');
  });
});
