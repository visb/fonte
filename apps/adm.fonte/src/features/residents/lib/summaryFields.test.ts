import { describe, expect, it } from 'vitest';
import { FamilyInvestment, Gender, MaritalStatus } from '@fonte/types';
import type { House } from '@fonte/api-client';
import {
  RESIDENT_SUMMARY_SECTIONS,
  formatSummaryValue,
  type SummaryFormatContext,
} from './summaryFields';

const houses = [
  { id: 'h1', name: 'Casa Belém' },
  { id: 'h2', name: 'Casa Nazaré' },
] as House[];
const ctx: SummaryFormatContext = { houses };

function fieldFormat(key: string) {
  for (const section of RESIDENT_SUMMARY_SECTIONS) {
    const found = section.fields.find((f) => f.key === key);
    if (found) return found.format;
  }
  throw new Error(`campo ${key} não encontrado`);
}

describe('RESIDENT_SUMMARY_SECTIONS', () => {
  it('tem as seções Ficha de cadastro e Admissão', () => {
    expect(RESIDENT_SUMMARY_SECTIONS.map((s) => s.title)).toEqual([
      'Ficha de cadastro',
      'Admissão',
    ]);
  });
});

describe('formatSummaryValue', () => {
  it('retorna vazio para null/undefined/string vazia', () => {
    expect(formatSummaryValue(null, ctx)).toBe('');
    expect(formatSummaryValue(undefined, ctx)).toBe('');
    expect(formatSummaryValue('', ctx)).toBe('');
  });

  it('retorna o valor cru (String) quando não há formatter', () => {
    expect(formatSummaryValue('João', ctx)).toBe('João');
    expect(formatSummaryValue(42, ctx)).toBe('42');
  });

  it('aplica o formatter quando presente', () => {
    expect(formatSummaryValue('h1', ctx, fieldFormat('houseId'))).toBe('Casa Belém');
  });
});

describe('formatters de campo', () => {
  it('houseName resolve id para nome e cai no próprio valor se não achar', () => {
    const fmt = fieldFormat('houseId')!;
    expect(fmt('h2', ctx)).toBe('Casa Nazaré');
    expect(fmt('desconhecida', ctx)).toBe('desconhecida');
    expect(fmt('', ctx)).toBe('');
  });

  it('gênero mapeia para o label', () => {
    const fmt = fieldFormat('gender')!;
    expect(fmt(Gender.MALE, ctx)).toBeTruthy();
    expect(fmt('valor-invalido', ctx)).toBe('');
  });

  it('estado civil mapeia para o label', () => {
    const fmt = fieldFormat('maritalStatus')!;
    expect(fmt(MaritalStatus.SINGLE, ctx)).toBeTruthy();
    expect(fmt('xx', ctx)).toBe('');
  });

  it('modalidade mapeia para o label', () => {
    const fmt = fieldFormat('familyInvestment')!;
    expect(fmt(FamilyInvestment.SOCIAL, ctx)).toBeTruthy();
    expect(fmt('xx', ctx)).toBe('');
  });

  it('data formata ISO e ignora valor inválido', () => {
    const fmt = fieldFormat('birthDate')!;
    expect(fmt('2026-06-10', ctx)).toContain('2026');
    expect(fmt('2026-06-10T08:00:00Z', ctx)).toContain('2026');
    expect(fmt('not-a-date', ctx)).toBe('');
    expect(fmt('', ctx)).toBe('');
    expect(fmt(123, ctx)).toBe('');
  });

  it('valor negociado prefixa R$ e ignora vazio', () => {
    const fmt = fieldFormat('familyInvestmentAmount')!;
    expect(fmt(150, ctx)).toBe('R$ 150');
    expect(fmt(null, ctx)).toBe('');
    expect(fmt('', ctx)).toBe('');
  });

  it('dia de vencimento prefixa "Dia" e ignora vazio', () => {
    const fmt = fieldFormat('contributionDueDay')!;
    expect(fmt(10, ctx)).toBe('Dia 10');
    expect(fmt(null, ctx)).toBe('');
    expect(fmt('', ctx)).toBe('');
  });
});
