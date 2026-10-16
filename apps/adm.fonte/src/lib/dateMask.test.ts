import { describe, expect, it } from 'vitest';
import { dateToIso, displayToIso, isoToDate, isoToDisplay, maskDate } from './dateMask';

describe('dateMask (story 201)', () => {
  it('maskDate aplica dd/mm/aaaa progressivamente e ignora não-dígitos', () => {
    expect(maskDate('')).toBe('');
    expect(maskDate('0')).toBe('0');
    expect(maskDate('07')).toBe('07');
    expect(maskDate('073')).toBe('07/3');
    expect(maskDate('0703')).toBe('07/03');
    expect(maskDate('07032')).toBe('07/03/2');
    expect(maskDate('07032026')).toBe('07/03/2026');
    expect(maskDate('07/03/2026999')).toBe('07/03/2026');
    expect(maskDate('ab07-03.2026')).toBe('07/03/2026');
  });

  it('isoToDate monta a data no fuso local e rejeita inválidos', () => {
    const d = isoToDate('2026-03-07')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 7]);
    expect(isoToDate('')).toBeUndefined();
    expect(isoToDate(null)).toBeUndefined();
    expect(isoToDate(undefined)).toBeUndefined();
    expect(isoToDate('2026-02-31')).toBeUndefined();
    expect(isoToDate('2026-13-01')).toBeUndefined();
    expect(isoToDate('2026-00-10')).toBeUndefined();
    expect(isoToDate('2026-01-00')).toBeUndefined();
    expect(isoToDate('0999-01-01')).toBeUndefined();
    expect(isoToDate('2026-03-07T10:00:00Z')).toBeUndefined();
  });

  it('dateToIso usa componentes locais com zero à esquerda', () => {
    expect(dateToIso(new Date(2026, 2, 7))).toBe('2026-03-07');
    expect(dateToIso(new Date(1975, 11, 31))).toBe('1975-12-31');
  });

  it('isoToDisplay converte e devolve vazio para inválido', () => {
    expect(isoToDisplay('2026-03-07')).toBe('07/03/2026');
    expect(isoToDisplay('')).toBe('');
    expect(isoToDisplay('lixo')).toBe('');
  });

  it('displayToIso converte data completa e válida; o resto vira vazio', () => {
    expect(displayToIso('07/03/2026')).toBe('2026-03-07');
    expect(displayToIso('29/02/2024')).toBe('2024-02-29');
    expect(displayToIso('29/02/2026')).toBe('');
    expect(displayToIso('31/02/2026')).toBe('');
    expect(displayToIso('07/03')).toBe('');
    expect(displayToIso('07/03/202')).toBe('');
    expect(displayToIso('')).toBe('');
  });
});
