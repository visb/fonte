import {
  getWeeklyAverage,
  getAutonomyWeeks,
  formatAutonomy,
} from './utils';
import type { StoreroomItem } from '@fonte/api-client';

function item(overrides: Partial<StoreroomItem> = {}): StoreroomItem {
  return {
    currentQuantity: 10,
    weeklyAverageUsage: 2,
    ...overrides,
  } as StoreroomItem;
}

describe('storeroom/utils — autonomia de estoque', () => {
  it('getWeeklyAverage converte a média semanal para número', () => {
    expect(getWeeklyAverage(item({ weeklyAverageUsage: '3.5' as never }))).toBe(3.5);
    expect(getWeeklyAverage(item({ weeklyAverageUsage: null as never }))).toBe(0);
  });

  it('getAutonomyWeeks = quantidade / média semanal', () => {
    expect(getAutonomyWeeks(item({ currentQuantity: 10 as never, weeklyAverageUsage: 2 as never }))).toBe(5);
  });

  it('getAutonomyWeeks devolve null quando média ≤ 0', () => {
    expect(getAutonomyWeeks(item({ weeklyAverageUsage: 0 as never }))).toBeNull();
  });

  it('formatAutonomy: "sem média" quando não há média', () => {
    expect(formatAutonomy(item({ weeklyAverageUsage: 0 as never }))).toBe('sem média');
  });

  it('formatAutonomy: "< 1 sem." quando autonomia < 1', () => {
    expect(formatAutonomy(item({ currentQuantity: 1 as never, weeklyAverageUsage: 2 as never }))).toBe('< 1 sem.');
  });

  it('formatAutonomy: "0 sem." quando a quantidade é zero', () => {
    expect(formatAutonomy(item({ currentQuantity: 0 as never, weeklyAverageUsage: 2 as never }))).toBe('0 sem.');
  });

  it('formatAutonomy: "N sem." (vírgula decimal) para autonomia ≥ 1', () => {
    expect(formatAutonomy(item({ currentQuantity: 5 as never, weeklyAverageUsage: 2 as never }))).toBe('2,5 sem.');
  });
});
