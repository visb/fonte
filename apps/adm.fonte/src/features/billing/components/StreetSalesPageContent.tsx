import { useState } from 'react';
import type { StreetSaleType } from '@fonte/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useStreetSalesReport } from '../hooks/useStreetSalesReport';
import { SalesSummaryCards } from './SalesSummaryCards';
import { SalesHistoryChart } from './SalesHistoryChart';
import { SalesByHouseTable } from './SalesByHouseTable';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface Props {
  type: StreetSaleType;
}

export function StreetSalesPageContent({ type }: Props) {
  const [month, setMonth] = useState(currentMonth);
  const [houseId, setHouseId] = useState<string | undefined>(undefined);

  const { data: houses = [] } = useHouses();
  const { data, isLoading, error } = useStreetSalesReport({ type, month, houseId });

  const hasData = data && data.byHouse.length > 0;

  return (
    <>
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
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState />}

      {data && !hasData && !isLoading && (
        <EmptyState title="Nenhum lançamento encontrado para o período selecionado." />
      )}

      {data && hasData && (
        <>
          <SalesSummaryCards data={data} />
          <SalesHistoryChart data={data} />
          <SalesByHouseTable byHouse={data.byHouse} />
        </>
      )}
    </>
  );
}
