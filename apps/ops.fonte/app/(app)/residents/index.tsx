import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { STATUS_CONFIG } from "@/lib/constants";
import { useResidentsByHouse } from "@/features/residents/hooks/useResidents";

export default function ResidentsScreen() {
  const { staff } = useAuth();
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: residents = [], isLoading, refetch } = useResidentsByHouse(staff?.houseId);

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
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search-outline" size={16} color="#6b7280" />
          <TextInput
            className="flex-1 ml-2 text-sm text-gray-800"
            placeholder="Buscar filho..."
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="#6b7280" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

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
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex-row items-center"
              onPress={() =>
                router.push(`/(app)/residents/${item.id}` as never)
              }
            >
              <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3">
                <Ionicons name="person-outline" size={20} color="#2563eb" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  {item.name}
                </Text>
              </View>
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: `${STATUS_CONFIG[item.status]?.color ?? '#6b7280'}20` }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: STATUS_CONFIG[item.status]?.color ?? '#6b7280' }}
                >
                  {STATUS_CONFIG[item.status]?.label ?? item.status}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
