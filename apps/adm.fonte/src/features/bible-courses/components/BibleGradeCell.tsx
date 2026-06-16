import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatGrade, parseGradeCell } from '../lib/bibleGradeSchema';

interface Props {
  value: number | null;
  disabled?: boolean;
  ariaLabel: string;
  onSave: (value: number | null) => void;
}

export function BibleGradeCell({ value, disabled, ariaLabel, onSave }: Props) {
  const [text, setText] = useState(formatGrade(value));
  const [error, setError] = useState<string | null>(null);

  // Mantém a célula em sincronia quando a matriz recarrega (ex.: após salvar).
  useEffect(() => {
    setText(formatGrade(value));
    setError(null);
  }, [value]);

  function handleBlur() {
    const parsed = parseGradeCell(text);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    if (parsed.value === value) {
      setText(formatGrade(value));
      return;
    }
    onSave(parsed.value);
  }

  return (
    <div className="flex flex-col items-stretch">
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        className={cn(
          'h-9 w-16 rounded-md border bg-background px-2 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
          error ? 'border-destructive' : 'border-input',
        )}
      />
      {error && <span className="mt-0.5 text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
