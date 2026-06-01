import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  steps: string[];
  current: number;
}

export function WizardSteps({ steps, current }: Props) {
  return (
    <ol className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                  !done && !active && 'border-muted text-muted-foreground',
                )}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm hidden sm:inline',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={cn('h-px flex-1 hidden sm:block', done ? 'bg-primary' : 'bg-muted')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
