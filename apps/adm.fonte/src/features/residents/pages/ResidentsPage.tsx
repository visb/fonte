import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import type { ResidentStatus } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDebounce } from '@/lib/useDebounce';
import { useInfiniteResidents, useDeleteResident } from '../hooks/useResidents';
import { ResidentCard } from '../components/ResidentCard';
import { ResidentsFilters } from '../components/ResidentsFilters';

export function ResidentsPage() {
  const [deleteTarget, setDeleteTarget] = useState<Resident | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ResidentStatus | ''>('');
  const [houseId, setHouseId] = useState('');
  const [overdueContribution, setOverdueContribution] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, 400);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteResidents({ search: debouncedSearch, status, houseId, overdueContribution });

  const deleteMutation = useDeleteResident();

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
    <div>
      <PageHeader
        title={total !== undefined ? `Filhos (${total})` : 'Filhos'}
        actions={
          <Button asChild>
            <Link to="/residents/admission">
              <Plus size={16} className="mr-2" />
              Novo acolhimento
            </Link>
          </Button>
        }
      />

      <ResidentsFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        houseId={houseId}
        onHouseIdChange={setHouseId}
        overdueContribution={overdueContribution}
        onOverdueContributionChange={setOverdueContribution}
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : residents.length === 0 ? (
        <EmptyState title="Nenhum acolhido encontrado." />
      ) : (
        <div className="space-y-3">
          {residents.map((resident) => (
            <ResidentCard
              key={resident.id}
              resident={resident}
              onDelete={() => setDeleteTarget(resident)}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir acolhido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
