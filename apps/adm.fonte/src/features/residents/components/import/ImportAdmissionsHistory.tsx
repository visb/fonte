import { LogIn, LogOut } from 'lucide-react';
import type { ImportAdmission } from '@fonte/api-client';
import { SectionTitle } from '@/components/shared/FormField';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '../../lib/receivables';
import { predictAdmissionStatus } from '../../lib/importCommit';
import { importAdmissionsIssues } from '../../lib/admissionDates';
import { IMPORT_TEXTS, RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '../../constants';

interface ImportAdmissionsHistoryProps {
  /** Acolhimentos detectados na planilha (`preview.resident.admissions`). */
  admissions: ImportAdmission[];
}

/**
 * Seção read-only "Acolhimentos detectados" do modal da ficha do import em lote
 * (story 121). Lista os pares entrada→saída que a planilha trouxe para o mesmo
 * filho com o status terminal que o backend derivará pela permanência (story
 * 120). Informativa: os `Admission` são criados no commit, não aqui. Só aparece
 * quando há mais de um acolhimento — um único já é o topo do resident. Não busca
 * dados do banco (o filho ainda não existe durante o import) nem edita.
 *
 * Story 203: passagem com data futura ou saída antes da entrada é marcada na
 * própria linha com a mensagem — o backend recusa o commit pelo mesmo motivo.
 */
export function ImportAdmissionsHistory({ admissions }: ImportAdmissionsHistoryProps) {
  if (admissions.length <= 1) return null;
  const issues = importAdmissionsIssues(admissions);

  return (
    <div className="space-y-3">
      <SectionTitle>{IMPORT_TEXTS.admissionsTitle}</SectionTitle>
      <ul className="space-y-2" aria-label={IMPORT_TEXTS.admissionsTitle}>
        {admissions.map((admission, index) => {
          const status = predictAdmissionStatus(admission);
          const issue = issues[index];
          return (
            <li
              key={`${admission.entryDate}-${admission.exitDate ?? 'aberto'}-${index}`}
              className={`rounded-md border px-3 py-2 text-xs ${
                issue ? 'border-destructive/50 bg-destructive/10' : 'bg-muted/40'
              }`}
              aria-invalid={issue ? true : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <LogIn size={13} className="text-emerald-600 dark:text-emerald-400" />
                    {formatDate(admission.entryDate)}
                  </span>
                  <span aria-hidden>→</span>
                  <span className="flex items-center gap-1">
                    <LogOut size={13} className="text-rose-600 dark:text-rose-400" />
                    {formatDate(admission.exitDate)}
                  </span>
                </span>
                <Badge variant={RESIDENT_STATUS_VARIANT[status]}>{RESIDENT_STATUS_LABELS[status]}</Badge>
              </div>
              {issue && <p className="mt-1 text-destructive">{issue}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
