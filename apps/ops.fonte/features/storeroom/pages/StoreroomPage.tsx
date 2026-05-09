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
import type { StoreroomItem } from "@fonte/api-client";
import { useAuth } from "@/lib/auth";
import { useStoreroomItems } from "@/features/storeroom/hooks/useStoreroom";
import { ItemDetailsModal } from "@/features/storeroom/components/ItemDetailsModal";
import { SuccessBanner } from "@/features/storeroom/components/SuccessBanner";
import { LowStockAlert } from "@/features/storeroom/components/LowStockAlert";
import { StoreroomItemCard } from "@/features/storeroom/components/StoreroomItemCard";

export function StoreroomPage() {
  const { staff } = useAuth();
  const { successMsg } = useLocalSearchParams<{ successMsg?: string }>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StoreroomItem | null>(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);

  const { data: items = [], isLoading, refetch } = useStoreroomItems(
    staff?.houseId,
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const lowStock = items.filter((i) => Number(i.currentQuantity) <= 5);

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
          ListHeaderComponent={<LowStockAlert items={lowStock} />}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <Text className="text-center text-gray-500 text-sm py-8">
              Nenhum item cadastrado na dispensa.
            </Text>
          }
          renderItem={({ item }) => (
            <StoreroomItemCard
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
        className="absolute bottom-6 right-6 bg-green-600 w-14 h-14 rounded-full items-center justify-center shadow-md"
        onPress={() => router.push("/(app)/storeroom/movement")}
      >
        <Ionicons name="swap-vertical" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
