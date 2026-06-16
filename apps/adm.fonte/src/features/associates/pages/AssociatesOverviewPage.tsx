import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useAssociatesOverview } from '../hooks/useAssociates';
import { OverviewKpiCards } from '../components/OverviewKpiCards';
import { OverviewIndicesCards } from '../components/OverviewIndicesCards';
import { BillingMonthlyChart } from '../components/BillingMonthlyChart';

export function AssociatesOverviewPage() {
  const { data, isLoading, error, refetch } = useAssociatesOverview(12);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Associados"
        description="Visão de gestão do faturamento mês a mês."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to="/billing/associados/lista">
              <Users size={14} className="mr-1.5" />
              Ver associados
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message={getErrorMessage(error, 'Erro ao carregar o overview.')}
          onRetry={refetch}
        />
      ) : !data ? (
        <EmptyState title="Sem dados de faturamento." />
      ) : (
        <>
          <OverviewKpiCards current={data.current} />
          <OverviewIndicesCards current={data.current} />
          <BillingMonthlyChart months={data.months} />
        </>
      )}
    </div>
  );
}
