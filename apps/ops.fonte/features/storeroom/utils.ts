import type { StoreroomItem } from '@fonte/api-client';
import { toNumber, formatQuantity } from '@/lib/inventoryUtils';

export {
  toNumber,
  formatQuantity,
  formatDateBR,
  toISODate,
  movementLabel,
} from '@/lib/inventoryUtils';

export function getWeeklyAverage(item: StoreroomItem): number {
  return toNumber(item.weeklyAverageUsage);
}

export function getAutonomyWeeks(item: StoreroomItem): number | null {
  const avg = getWeeklyAverage(item);
  if (avg <= 0) return null;
  return toNumber(item.currentQuantity) / avg;
}

export function formatAutonomy(item: StoreroomItem): string {
  const autonomy = getAutonomyWeeks(item);
  if (autonomy === null) return 'sem média';
  if (autonomy === 0) return '0 sem.';
  if (autonomy < 1) return '< 1 sem.';
  return `${formatQuantity(autonomy)} sem.`;
}
