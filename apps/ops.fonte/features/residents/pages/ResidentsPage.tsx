import { useState } from "react";
import { View, FlatList } from "react-native";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ResidentStatus, type ResidentRowAction } from "@fonte/types";
import { useAuth } from "@/lib/auth";
import { normalizeForSearch } from "@/lib/searchUtils";
import { useResidentsByHouse } from "@/features/residents/hooks/useResidents";
import { ResidentSearchBar } from "@/features/residents/components/ResidentSearchBar";
import { ResidentStatusFilterModal } from "@/features/residents/components/ResidentStatusFilterModal";
import { ResidentListItem } from "@/features/residents/components/ResidentListItem";
import { ResidentRowMenuSheet } from "@/features/residents/components/ResidentRowMenuSheet";
import { RemoveResidentModal } from "@/features/residents/components/RemoveResidentModal";
import { LastSyncedAt } from "@/components/shared/LastSyncedAt";
import { useLastSyncedAt } from "@/lib/offline/store/useLastSyncedAt";
import {
  DEFAULT_RESIDENT_STATUS_FILTER,
  RESIDENT_STATUS_FILTER_OPTIONS,
} from "@/features/residents/constants";

type RemovalTarget = { id: string; name: string; entryDate: string | null };

export function ResidentsPage() {
  const { staff } = useAuth();
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ResidentStatus[]>(
    DEFAULT_RESIDENT_STATUS_FILTER,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  // Story 196: um menu e um modal POR PÁGINA — item de lista não instancia
  // `Modal` (seriam N modais montados numa lista de casa cheia).
  // Story 203: `entryDate` segue para o modal (limite da saída), do cache da lista.
  const [menuTarget, setMenuTarget] = useState<RemovalTarget | null>(null);
  // Story 200: o modal abre no modo do item escolhido (saída ou transferência).
  const [removeTarget, setRemoveTarget] = useState<{
    resident: RemovalTarget;
    mode: ResidentRowAction;
  } | null>(null);

  const { data: residents = [], isLoading, error, refetch } = useResidentsByHouse(
    staff?.houseId,
  );
  // Story 175: a lista não some mais por idade — a tela diz de quando ela é.
  const syncedAt = useLastSyncedAt(staff?.houseId);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const filterActive =
    statusFilter.length !== RESIDENT_STATUS_FILTER_OPTIONS.length;

  const filtered = residents.filter(
    (r) =>
      normalizeForSearch(r.name).includes(normalizeForSearch(search)) &&
      (statusFilter.length === 0 ||
        statusFilter.includes(r.status as ResidentStatus)),
  );

  return (
    <View className="flex-1 bg-gray-50">
      <ResidentSearchBar
        value={search}
        onChangeText={setSearch}
        onClear={() => setSearch("")}
        onPressFilter={() => setFilterOpen(true)}
        filterActive={filterActive}
      />

      <LastSyncedAt syncedAt={syncedAt} />

      <ResidentStatusFilterModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={statusFilter}
        onApply={(statuses) => {
          setStatusFilter(statuses);
          setFilterOpen(false);
        }}
      />

      {isLoading ? (
        <LoadingState />
      ) : error && residents.length === 0 ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <EmptyState message="Nenhum filho encontrado." />
          }
          renderItem={({ item }) => (
            <ResidentListItem
              item={item}
              onOpenMenu={(resident) =>
                setMenuTarget({
                  id: resident.id,
                  name: resident.name,
                  entryDate: resident.entryDate ?? null,
                })
              }
            />
          )}
        />
      )}

      <ResidentRowMenuSheet
        visible={!!menuTarget}
        residentName={menuTarget?.name}
        onClose={() => setMenuTarget(null)}
        onSelect={(mode) => {
          setRemoveTarget(menuTarget ? { resident: menuTarget, mode } : null);
          setMenuTarget(null);
        }}
      />

      <RemoveResidentModal
        visible={!!removeTarget}
        houseId={staff?.houseId ?? ""}
        resident={removeTarget?.resident ?? null}
        mode={removeTarget?.mode}
        onClose={() => setRemoveTarget(null)}
        onSuccess={() => refetch()}
      />
    </View>
  );
}
