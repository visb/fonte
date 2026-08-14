import { ResidentStatus } from '@fonte/types';
import {
  ageInYears,
  censusStatusColor,
  censusStatusLabel,
  formatBirthDate,
  formatDate,
} from './residentDetails';

const TODAY = new Date('2026-08-14T12:00:00');

describe('formatDate', () => {
  it('formata data ISO simples e ISO com hora', () => {
    expect(formatDate('2026-03-10')).toBe('10/03/2026');
    expect(formatDate('2026-03-10T00:00:00.000Z')).toBe('10/03/2026');
  });

  it('sem data devolve nulo', () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
    expect(formatDate('sem-data')).toBeNull();
  });
});

describe('ageInYears', () => {
  it('conta anos completos', () => {
    expect(ageInYears('1990-03-10', TODAY)).toBe(36);
  });

  it('aniversário ainda não feito no ano desconta um ano', () => {
    expect(ageInYears('1990-12-01', TODAY)).toBe(35);
  });

  it('aniversário no mesmo mês, dia ainda por vir, desconta um ano', () => {
    expect(ageInYears('1990-08-20', TODAY)).toBe(35);
  });

  it('aniversário exatamente hoje já conta o ano', () => {
    expect(ageInYears('1990-08-14', TODAY)).toBe(36);
  });

  it('sem data (ou data inválida) devolve nulo', () => {
    expect(ageInYears(null, TODAY)).toBeNull();
    expect(ageInYears('xx', TODAY)).toBeNull();
  });

  it('data no futuro não vira idade negativa', () => {
    expect(ageInYears('2030-01-01', TODAY)).toBeNull();
  });
});

describe('formatBirthDate', () => {
  it('junta data e idade', () => {
    expect(formatBirthDate('1990-03-10', TODAY)).toBe('10/03/1990 · 36 anos');
  });

  it('um ano fica no singular', () => {
    expect(formatBirthDate('2025-03-10', TODAY)).toBe('10/03/2025 · 1 ano');
  });

  it('data futura mostra só a data', () => {
    expect(formatBirthDate('2030-01-01', TODAY)).toBe('01/01/2030');
  });

  it('sem data devolve nulo', () => {
    expect(formatBirthDate(null, TODAY)).toBeNull();
  });
});

describe('censusStatusLabel / censusStatusColor', () => {
  it('CENSUS_ADDED usa o mesmo rótulo do badge da lista', () => {
    expect(censusStatusLabel(ResidentStatus.CENSUS_ADDED)).toBe('Aguardando aprovação');
    expect(censusStatusColor(ResidentStatus.CENSUS_ADDED)).toBe('#b45309');
  });

  it('status conhecido usa o catálogo compartilhado', () => {
    expect(censusStatusLabel(ResidentStatus.ACTIVE)).toBe('Ativo');
    expect(censusStatusColor(ResidentStatus.ACTIVE)).toBe('#16a34a');
  });

  it('status desconhecido cai no código cru e no cinza', () => {
    expect(censusStatusLabel('WEIRD')).toBe('WEIRD');
    expect(censusStatusColor('WEIRD')).toBe('#6b7280');
  });
});
