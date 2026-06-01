import { useMemo } from "react";
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SupplyRoomItem } from "@fonte/api-client";
import { useSupplyRoomMovements } from "../hooks/useSupplyRoom";
import { formatQuantity } from "../utils";
import { CategoryBadge } from "./CategoryBadge";
import { MovementHistoryRow } from "./MovementHistoryRow";

const MOVEMENT_HISTORY_LIMIT = 30;

export function ItemDetailsModal({
  item,
  visible,
  onClose,
}: {
  item: SupplyRoomItem | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { data: movements = [], isLoading, isError } = useSupplyRoomMovements(
    visible ? item?.id : undefined,
  );

  const latestMovements = useMemo(
    () => movements.slice(0, MOVEMENT_HISTORY_LIMIT),
    [movements],
  );

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl max-h-[88%]">
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <View className="w-11 h-11 rounded-full bg-blue-50 items-center justify-center mr-3">
              <Ionicons name="spray-outline" size={22} color="#2563eb" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900">{item.name}</Text>
              <CategoryBadge category={item.category} />
            </View>
            <Pressable
              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>

          <ScrollView className="px-5" contentContainerClassName="py-4">
            <View className="bg-gray-50 rounded-xl px-4 py-3 mb-5">
              <Text className="text-xs text-gray-500">Estoque atual</Text>
              <Text className="text-base font-semibold text-gray-900 mt-1">
                {formatQuantity(item.currentQuantity)} {item.unit}
              </Text>
            </View>

            <View>
              <Text className="text-sm font-semibold text-gray-900 mb-1">
                Histórico de movimentações
              </Text>
              <Text className="text-xs text-gray-500 mb-3">
                Últimas {MOVEMENT_HISTORY_LIMIT} movimentações
              </Text>

              {isLoading ? (
                <ActivityIndicator color="#2563eb" />
              ) : isError ? (
                <Text className="text-sm text-red-600">
                  Não foi possível carregar o histórico.
                </Text>
              ) : latestMovements.length === 0 ? (
                <Text className="text-sm text-gray-500 py-3">
                  Sem movimentações para este item.
                </Text>
              ) : (
                <View className="gap-2">
                  {latestMovements.map((movement) => (
                    <MovementHistoryRow key={movement.id} movement={movement} unit={item.unit} />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
