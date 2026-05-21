import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useIncidents } from "@/features/incidents/hooks/useIncidents";
import { IncidentCard } from "@/features/incidents/components/IncidentCard";

export function IncidentsPage() {
  const { staff } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: incidents = [], isLoading, refetch } = useIncidents(
    staff?.houseId,
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <View className="flex-1 bg-gray-50">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item: { id: string }) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <Text className="text-center text-gray-500 text-sm py-8">
              Nenhuma ocorrência registrada.
            </Text>
          }
          renderItem={({ item }) => <IncidentCard item={item} />}
        />
      )}

      <TouchableOpacity
        accessibilityLabel="Nova ocorrência"
        className="absolute bottom-6 right-6 bg-red-600 w-14 h-14 rounded-full items-center justify-center shadow-md"
        onPress={() => router.push("/(app)/incidents/new")}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
