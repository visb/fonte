import { describe, expect, it } from 'vitest';
import { normalizeLinkHref } from './links';

describe('normalizeLinkHref (story 72 — link seguro no editor)', () => {
  it('vazio devolve null', () => {
    expect(normalizeLinkHref('')).toBeNull();
    expect(normalizeLinkHref('   ')).toBeNull();
  });

  it('preserva https e http', () => {
    expect(normalizeLinkHref('https://x.com')).toBe('https://x.com');
    expect(normalizeLinkHref('http://x.com')).toBe('http://x.com');
  });

  it('preserva mailto, tel, âncora e relativo', () => {
    expect(normalizeLinkHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(normalizeLinkHref('tel:+5511999999999')).toBe('tel:+5511999999999');
    expect(normalizeLinkHref('#sec')).toBe('#sec');
    expect(normalizeLinkHref('/painel')).toBe('/painel');
  });

  it('prefixa https:// quando falta esquema', () => {
    expect(normalizeLinkHref('exemplo.com')).toBe('https://exemplo.com');
    expect(normalizeLinkHref('  exemplo.com/x  ')).toBe('https://exemplo.com/x');
  });

  it('rejeita javascript: (devolve null)', () => {
    expect(normalizeLinkHref('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkHref('JavaScript:alert(1)')).toBeNull();
  });

  it('rejeita data: e vbscript:', () => {
    expect(normalizeLinkHref('data:text/html,evil')).toBeNull();
    expect(normalizeLinkHref('vbscript:msgbox(1)')).toBeNull();
  });
});
