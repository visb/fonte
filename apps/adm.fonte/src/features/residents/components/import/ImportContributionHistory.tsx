import { CalendarCheck } from 'lucide-react';
import { SectionTitle } from '@/components/shared/FormField';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatReferenceMonth } from '../../lib/receivables';
import { IMPORT_TEXTS } from '../../constants';

interface ImportContributionHistoryProps {
  /** Competências pagas vindas da planilha (`preview.contributionMonths`): ['2023-01-01', ...]. */
  months: string[];
}

/**
 * Seção read-only do histórico de contribuição no modal da ficha do import em
 * lote (story 108). Exibe as competências parseadas da planilha
 * (`preview.contributionMonths`) para conferência antes de aprovar — não busca
 * recebíveis do banco (o filho ainda não existe durante o import) nem edita.
 * Cada competência é uma string ISO (`'2023-01-01'`); o shape não carrega valor
 * monetário, então só a competência é exibida.
 */
export function ImportContributionHistory({ months }: ImportContributionHistoryProps) {
  return (
    <div className="space-y-3">
      <SectionTitle>{IMPORT_TEXTS.contributionHistoryTitle}</SectionTitle>
      {months.length === 0 ? (
        <EmptyState title={IMPORT_TEXTS.contributionHistoryEmpty} />
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={IMPORT_TEXTS.contributionHistoryTitle}>
          {months.map((month) => (
            <li
              key={month}
              className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
            >
              <CalendarCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>{formatReferenceMonth(month)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
