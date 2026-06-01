import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { SupplyRoomItem } from "@fonte/api-client";
import { useAuth } from "@/lib/auth";
import { useSupplyRoomItems } from "@/features/supply-room/hooks/useSupplyRoom";
import { ItemDetailsModal } from "@/features/supply-room/components/ItemDetailsModal";
import { SupplyRoomItemCard } from "@/features/supply-room/components/SupplyRoomItemCard";
import { SuccessBanner } from "@/components/shared/SuccessBanner";

export function SupplyRoomPage() {
  const { staff } = useAuth();
  const { successMsg } = useLocalSearchParams<{ successMsg?: string }>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SupplyRoomItem | null>(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);

  const { data: items = [], isLoading, refetch } = useSupplyRoomItems(staff?.houseId);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <View className="flex-1 bg-gray-50">
      {successMsg ? (
        <SuccessBanner
          message={successMsg}
          onDismiss={() => router.setParams({ successMsg: "" })}
        />
      ) : null}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <Text className="text-center text-gray-500 text-sm py-8">
              Nenhum item cadastrado no almoxarifado.
            </Text>
          }
          renderItem={({ item }) => (
            <SupplyRoomItemCard
              item={item}
              onPress={() => {
                setSelectedItem(item);
                setIsDetailsModalVisible(true);
              }}
            />
          )}
        />
      )}

      <ItemDetailsModal
        item={selectedItem}
        visible={isDetailsModalVisible}
        onClose={() => setIsDetailsModalVisible(false)}
      />

      <TouchableOpacity
        accessibilityLabel="Movimentar item"
        className="absolute bottom-6 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center shadow-md"
        onPress={() => router.push("/(app)/supply-room/movement")}
      >
        <Ionicons name="swap-vertical" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
