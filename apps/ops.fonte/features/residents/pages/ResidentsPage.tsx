import { useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { useAuth } from "@/lib/auth";
import { useResidentsByHouse } from "@/features/residents/hooks/useResidents";
import { ResidentSearchBar } from "@/features/residents/components/ResidentSearchBar";
import { ResidentListItem } from "@/features/residents/components/ResidentListItem";

export function ResidentsPage() {
  const { staff } = useAuth();
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: residents = [], isLoading, refetch } = useResidentsByHouse(
    staff?.houseId,
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const filtered = residents.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View className="flex-1 bg-gray-50">
      <ResidentSearchBar
        value={search}
        onChangeText={setSearch}
        onClear={() => setSearch("")}
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
