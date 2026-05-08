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
import { SEVERITY_CONFIG } from "@/lib/constants";
import { useIncidents } from "@/features/incidents/hooks/useIncidents";

function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function IncidentsScreen() {
  const { staff } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: incidents = [], isLoading, refetch } = useIncidents(staff?.houseId);

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
          renderItem={({
            item,
          }: {
            item: {
              id: string;
              date: string;
              severity: string;
              description: string;
              responsible: { name: string };
              resident: { name: string } | null;
            };
          }) => (
            <View className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs text-gray-500">{fmt(item.date)}</Text>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: `${SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG]?.color ?? '#6b7280'}20`,
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG]?.color ?? '#6b7280' }}
                  >
                    {SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG]?.label ?? item.severity}
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-gray-800 mb-1.5" numberOfLines={3}>
                {item.description}
              </Text>
              <Text className="text-xs text-gray-400">
                por {item.responsible?.name}
              </Text>
              {item.resident && (
                <Text className="text-xs text-blue-600 mt-0.5">
                  Filho: {item.resident.name}
                </Text>
              )}
            </View>
          )}
        />
      )}

      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-red-600 w-14 h-14 rounded-full items-center justify-center shadow-md"
        onPress={() => router.push("/(app)/incidents/new")}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
