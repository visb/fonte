import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
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
import { RESIDENT_SORT_PARAMS, toResidentSortOption } from '../constants';

export function ResidentsPage() {
  const [deleteTarget, setDeleteTarget] = useState<Resident | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filtros persistidos na URL. Status ausente = "Ativo" (padrão da listagem);
  // presente-e-vazio = "Todos os status" (o usuário optou explicitamente).
  const status = (searchParams.has('status')
    ? searchParams.get('status')
    : ResidentStatus.ACTIVE) as ResidentStatus | '';
  const houseId = searchParams.get('house') ?? '';
  const overdueContribution = searchParams.get('overdue') === '1';
  // Ordenação vem da URL; ausente = padrão da tela (mais recentes primeiro).
  const sortOption = toResidentSortOption(searchParams.get('sort'));
  const sortParams = RESIDENT_SORT_PARAMS[sortOption];

  const setParam = (key: string, value: string | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === undefined) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  // Busca: input controlado localmente (responsivo) e sincronizado à URL após debounce.
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    setParam('q', debouncedSearch || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteResidents({
    search: debouncedSearch,
    status,
    houseId,
    overdueContribution,
    sort: sortParams.sort,
    order: sortParams.order,
  });

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
        onStatusChange={(value) => setParam('status', value)}
        houseId={houseId}
        onHouseIdChange={(value) => setParam('house', value || undefined)}
        overdueContribution={overdueContribution}
        onOverdueContributionChange={(value) => setParam('overdue', value ? '1' : undefined)}
        sort={sortOption}
        onSortChange={(value) => setParam('sort', value)}
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
