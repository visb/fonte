import type { Admission } from '@fonte/api-client';
import { Select } from '@/components/ui/select';
import { formatDate } from '../lib/receivables';

interface Props {
  /** Ordem do backend: índice 0 é o acolhimento atual. */
  admissions: Admission[];
  selectedAdmissionId: string | null;
  onChange: (admissionId: string) => void;
}

/** "Acolhimento 2 — 17/07/2026 a em aberto (atual)" */
export function admissionOptionLabel(admission: Admission, number: number, isCurrent: boolean): string {
  const exit = admission.exitDate ? formatDate(admission.exitDate) : 'em aberto';
  const suffix = isCurrent ? ' (atual)' : '';
  return `Acolhimento ${number} — ${formatDate(admission.entryDate)} a ${exit}${suffix}`;
}

/**
 * Seletor de acolhimento da aba Contribuições (story 164).
 *
 * Filho com um acolhimento só não ganha seletor: a aba fica idêntica à de antes
 * da story — nada de UI nova para o caso que sempre funcionou.
 */
export function ContributionAdmissionSelector({ admissions, selectedAdmissionId, onChange }: Props) {
  if (admissions.length <= 1) return null;

  return (
    <div className="space-y-1">
      <label
        htmlFor="contribution-admission"
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Acolhimento
      </label>
      <Select
        id="contribution-admission"
        aria-label="Acolhimento"
        value={selectedAdmissionId ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {admissions.map((admission, index) => (
          <option key={admission.id} value={admission.id}>
            {admissionOptionLabel(admission, admissions.length - index, index === 0)}
          </option>
        ))}
      </Select>
    </div>
  );
}
