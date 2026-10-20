import type { StaffServicePeriod } from '@fonte/types';
import type { Admission } from '@fonte/api-client';

/**
 * Item da linha do tempo do Histórico (stories 215/216): acolhimento (fase de
 * filho) ou período de serviço (fase de servo).
 */
export type HistoryItem =
  | { kind: 'admission'; key: string; title: string; startDate: string; admission: Admission }
  | { kind: 'service'; key: string; title: string; startDate: string; period: StaffServicePeriod };

const day = (value?: string | null) => (value ? value.slice(0, 10) : '');

/**
 * Mistura acolhimentos e períodos de serviço, do início mais recente ao mais
 * antigo. Acolhimentos chegam na ordem do backend (maior entrada primeiro,
 * story 164) e são numerados por ela; empate de data mantém o período de
 * serviço antes (a promoção encerra o acolhimento no mesmo dia).
 */
export function buildHistory(
  admissions: readonly Admission[],
  periods: readonly StaffServicePeriod[] = [],
): HistoryItem[] {
  const admissionItems: HistoryItem[] = admissions.map((admission, index) => ({
    kind: 'admission',
    key: `admission-${admission.id}`,
    title: `Acolhimento ${admissions.length - index}`,
    startDate: day(admission.entryDate),
    admission,
  }));
  if (periods.length === 0) return admissionItems;

  const serviceItems: HistoryItem[] = periods.map((period) => ({
    kind: 'service',
    key: `service-${period.id}`,
    title: 'Período de serviço',
    startDate: day(period.startDate),
    period,
  }));
  return [...serviceItems, ...admissionItems].sort((a, b) =>
    a.startDate === b.startDate ? 0 : a.startDate < b.startDate ? 1 : -1,
  );
}
