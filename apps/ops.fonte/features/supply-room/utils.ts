import { MovementType } from '@fonte/types';

export function toNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatQuantity(value: number | string | null | undefined): string {
  const n = toNumber(value);
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace('.', ',');
}

export function formatDateBR(iso: string): string {
  const date = iso.split('T')[0];
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function toISODate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function movementLabel(type: MovementType): string {
  return type === MovementType.IN ? 'Entrada' : 'Saída';
}
