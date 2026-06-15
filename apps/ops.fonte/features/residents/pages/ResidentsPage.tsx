import { useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { ResidentStatus } from "@fonte/types";
import { useAuth } from "@/lib/auth";
import { normalizeForSearch } from "@/lib/searchUtils";
import { useResidentsByHouse } from "@/features/residents/hooks/useResidents";
import { ResidentSearchBar } from "@/features/residents/components/ResidentSearchBar";
import { ResidentStatusFilterModal } from "@/features/residents/components/ResidentStatusFilterModal";
import { ResidentListItem } from "@/features/residents/components/ResidentListItem";
import {
  DEFAULT_RESIDENT_STATUS_FILTER,
  RESIDENT_STATUS_FILTER_OPTIONS,
} from "@/features/residents/constants";

export function ResidentsPage() {
  const { staff } = useAuth();
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ResidentStatus[]>(
    DEFAULT_RESIDENT_STATUS_FILTER,
  );
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: residents = [], isLoading, refetch } = useResidentsByHouse(
    staff?.houseId,
  );

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
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <Text className="text-center text-gray-500 text-sm py-8">
              Nenhum filho encontrado.
            </Text>
          }
          renderItem={({ item }) => <ResidentListItem item={item} />}
        />
      )}
    </View>
  );
}
