import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useDebounce } from '@/lib/useDebounce';
import { useInfiniteResidents } from '@/features/residents/hooks/useResidents';
import { ResidentsFilters } from '@/features/residents/components/ResidentsFilters';
import {
  RESIDENT_SORT_DEFAULT,
  RESIDENT_SORT_PARAMS,
  type ResidentSortOption,
} from '@/features/residents/constants';
import { HouseResidentRow } from './HouseResidentRow';
import { HouseResidentDetailDialog } from './HouseResidentDetailDialog';

/**
 * Aba Filhos do detalhe da casa: infinite scroll + filtros + busca sobre
 * `GET /residents` com `houseId` fixo (a casa desta tela). Estado dos filtros é
 * local à aba — não persiste em preferência nem escreve na URL (story 150).
 */
export function ResidentsTab({ houseId }: { houseId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ResidentStatus | ''>('');
  const [overdueContribution, setOverdueContribution] = useState(false);
  const [sortOption, setSortOption] = useState<ResidentSortOption>(RESIDENT_SORT_DEFAULT);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, 400);
  const sortParams = RESIDENT_SORT_PARAMS[sortOption];

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteResidents({
    houseId,
    search: debouncedSearch,
    status,
    overdueContribution,
    sort: sortParams.sort,
    order: sortParams.order,
  });

  const residents = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <div className="mb-3 text-sm font-medium text-muted-foreground">
        {total !== undefined ? `Filhos (${total})` : 'Filhos'}
      </div>

      <ResidentsFilters
        hideHouseFilter
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        overdueContribution={overdueContribution}
        onOverdueContributionChange={setOverdueContribution}
        sort={sortOption}
        onSortChange={setSortOption}
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : residents.length === 0 ? (
        <EmptyState title="Nenhum filho encontrado." />
      ) : (
        <div className="space-y-1">
          {residents.map((resident) => (
            <HouseResidentRow key={resident.id} resident={resident} onSelect={setSelectedId} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        )}
      </div>

      <HouseResidentDetailDialog residentId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
