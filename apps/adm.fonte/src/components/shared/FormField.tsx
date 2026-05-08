import { type ReactNode } from 'react';
import { Label } from '@/components/ui/label';

interface SectionTitleProps {
  children: ReactNode;
}

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-6 pb-2 border-b mb-4">
      {children}
    </h2>
  );
}

interface FormFieldProps {
  label: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}

export function FormField({ label, error, full, children }: FormFieldProps) {
  return (
    <div className={full ? 'col-span-full space-y-1.5' : 'space-y-1.5'}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
