import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useContributionsReport } from '../hooks/useContributions';
import { ContributionSummaryCards } from '../components/ContributionSummaryCards';
import { ContributionReportTable } from '../components/ContributionReportTable';

function currentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function FilhosPage() {
  const [month, setMonth] = useState(currentMonth);
  const [houseId, setHouseId] = useState<string | undefined>(undefined);

  const { data: houses = [] } = useHouses();
  const { data, isLoading, error } = useContributionsReport({ month, houseId });

  return (
    <div>
      <PageHeader title="Filhos — Contribuições" />

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="month-filter">Mês</Label>
          <Input
            id="month-filter"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="house-filter">Casa</Label>
          <Select
            id="house-filter"
            value={houseId ?? ''}
            onChange={(e) => setHouseId(e.target.value || undefined)}
            className="w-48"
          >
            <option value="">Todas as casas</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState />}

      {data && (
        <>
          <ContributionSummaryCards
            totalResidents={data.totalResidents}
            totalPaid={data.totalPaid}
            totalPending={data.totalPending}
            totalExpectedAmount={data.totalExpectedAmount}
            totalCollectedAmount={data.totalCollectedAmount}
          />

          {data.items.length === 0 ? (
            <EmptyState title="Nenhum resultado para o período selecionado." />
          ) : (
            <ContributionReportTable items={data.items} />
          )}
        </>
      )}
    </div>
  );
}
