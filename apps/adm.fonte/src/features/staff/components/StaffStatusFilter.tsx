import type { StaffListStatus } from '@fonte/types';
import { cn } from '@/lib/utils';

interface Props {
  value: StaffListStatus;
  onChange: (value: StaffListStatus) => void;
}

const OPTIONS: Array<{ value: StaffListStatus; label: string }> = [
  { value: 'active', label: 'Ativos' },
  { value: 'dismissed', label: 'Desligados' },
];

/** Story 217 — alterna a lista de servos entre ativos e desligados. */
export function StaffStatusFilter({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Situação dos servos" className="inline-flex rounded-md border p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1 text-sm rounded-sm transition-colors',
            value === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
