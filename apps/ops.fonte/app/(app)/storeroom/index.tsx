import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Modal,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MovementType } from "@fonte/types";
import type { StoreroomItem, StoreroomMovement } from "@fonte/api-client";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import { useAuth } from "@/lib/auth";
import { useStoreroomItems, useStoreroomMovements } from "@/features/storeroom/hooks/useStoreroom";

const MOVEMENT_HISTORY_LIMIT = 30;

function toNumber(value: number | string | null | undefined): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatQuantity(value: number | string | null | undefined): string {
  const numberValue = toNumber(value);
  const rounded = Math.round(numberValue * 100) / 100;
  return String(rounded).replace(".", ",");
}

function formatDateBR(iso: string): string {
  const date = iso.split("T")[0];
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function getWeeklyAverage(item: StoreroomItem): number {
  return toNumber(item.weeklyAverageUsage);
}

function getAutonomyWeeks(item: StoreroomItem): number | null {
  const weeklyAverage = getWeeklyAverage(item);
  if (weeklyAverage <= 0) return null;
  return toNumber(item.currentQuantity) / weeklyAverage;
}

function formatAutonomy(item: StoreroomItem): string {
  const autonomy = getAutonomyWeeks(item);
  if (autonomy === null) return "sem média";
  if (autonomy === 0) return "0 sem.";
  if (autonomy < 1) return "< 1 sem.";
  return `${formatQuantity(autonomy)} sem.`;
}

function movementLabel(type: MovementType): string {
  return type === MovementType.IN ? "Entrada" : "Saída";
}

function MovementChart({
  movements,
  unit,
}: {
  movements: StoreroomMovement[];
  unit: string;
}) {
  if (movements.length === 0) {
    return (
      <View className="bg-gray-50 rounded-xl px-4 py-6 items-center">
        <Ionicons name="bar-chart-outline" size={24} color="#9ca3af" />
        <Text className="text-sm text-gray-500 mt-2">
          Sem movimentações para este item.
        </Text>
      </View>
    );
  }

  const maxQuantity = Math.max(
    ...movements.map((movement) => toNumber(movement.quantity)),
    1,
  );

  return (
    <View className="bg-gray-50 rounded-xl px-4 py-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="h-32 flex-row items-end gap-1 pr-1">
          {movements.map((movement) => {
            const quantity = toNumber(movement.quantity);
            const height = Math.max(8, (quantity / maxQuantity) * 104);
            const isEntry = movement.type === MovementType.IN;

            return (
              <View key={movement.id} className="items-center justify-end">
                <View
                  className={`w-3 rounded-t-sm ${isEntry ? "bg-green-500" : "bg-red-500"}`}
                  style={{ height }}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View className="flex-row items-center justify-between mt-3">
        <View className="flex-row items-center">
          <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5" />
          <Text className="text-xs text-gray-500">Entrada</Text>
        </View>
        <Text className="text-xs text-gray-400">
          Máx. {formatQuantity(maxQuantity)} {unit}
        </Text>
        <View className="flex-row items-center">
          <View className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" />
          <Text className="text-xs text-gray-500">Saída</Text>
        </View>
      </View>
    </View>
  );
}

function ItemDetailsModal({
  item,
  visible,
  onClose,
}: {
  item: StoreroomItem | null;
  visible: boolean;
  onClose: () => void;
}) {
  const {
    data: movements = [],
    isLoading,
    isError,
  } = useStoreroomMovements(visible ? item?.id : undefined);

  const latestMovements = useMemo(
    () => movements.slice(0, MOVEMENT_HISTORY_LIMIT),
    [movements],
  );
  const chartMovements = useMemo(
    () => [...latestMovements].reverse(),
    [latestMovements],
  );

  if (!item) return null;

  const weeklyAverage = getWeeklyAverage(item);
  const hasWeeklyAverage = weeklyAverage > 0;
  const averageWindow =
    item.weeklyAverageWindowStart && item.weeklyAverageWindowEnd
      ? `${formatDateBR(item.weeklyAverageWindowStart)} a ${formatDateBR(
          item.weeklyAverageWindowEnd,
        )}`
      : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl max-h-[88%]">
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <View className="w-11 h-11 rounded-full bg-green-50 items-center justify-center mr-3">
              <Ionicons name="cube-outline" size={22} color="#16a34a" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900">{item.name}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                Detalhes da dispensa
              </Text>
            </View>
            <Pressable
              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>

          <ScrollView className="px-5" contentContainerStyle={{ paddingVertical: 16 }}>
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                <Text className="text-xs text-gray-500">Estoque atual</Text>
                <Text className="text-base font-semibold text-gray-900 mt-1">
                  {formatQuantity(item.currentQuantity)} {item.unit}
                </Text>
              </View>
              <View className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                <Text className="text-xs text-gray-500">Autonomia estimada</Text>
                <Text className="text-base font-semibold text-gray-900 mt-1">
                  {formatAutonomy(item)}
                </Text>
              </View>
            </View>

            <View className="bg-blue-50 rounded-xl px-4 py-3 mb-5">
              <Text className="text-xs text-blue-700">Consumo médio semanal</Text>
              <Text className="text-base font-semibold text-blue-900 mt-1">
                {hasWeeklyAverage
                  ? `${formatQuantity(weeklyAverage)} ${item.unit}/sem.`
                  : "Média ainda não calculada"}
              </Text>
              {averageWindow ? (
                <Text className="text-xs text-blue-700 mt-1">
                  Janela: {averageWindow}
                </Text>
              ) : null}
            </View>

            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-900 mb-2">
                Gráfico de movimentações
              </Text>
              {isLoading ? (
                <View className="bg-gray-50 rounded-xl py-8 items-center">
                  <ActivityIndicator color="#2563eb" />
                </View>
              ) : isError ? (
                <View className="bg-red-50 rounded-xl px-4 py-4">
                  <Text className="text-sm text-red-600">
                    Não foi possível carregar o histórico.
                  </Text>
                </View>
              ) : (
                <MovementChart movements={chartMovements} unit={item.unit} />
              )}
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
                  {latestMovements.map((movement) => {
                    const isEntry = movement.type === MovementType.IN;
                    return (
                      <View
                        key={movement.id}
                        className="border border-gray-100 rounded-xl px-4 py-3 bg-white"
                      >
                        <View className="flex-row items-center">
                          <View
                            className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                              isEntry ? "bg-green-50" : "bg-red-50"
                            }`}
                          >
                            <Ionicons
                              name={isEntry ? "arrow-up" : "arrow-down"}
                              size={16}
                              color={isEntry ? "#16a34a" : "#dc2626"}
                            />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-gray-900">
                              {movementLabel(movement.type)} de {formatQuantity(movement.quantity)} {item.unit}
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5">
                              {formatDateBR(movement.date)} • {movement.responsible?.name ?? "Sem responsável"}
                            </Text>
                          </View>
                        </View>
                        {movement.notes ? (
                          <Text className="text-xs text-gray-500 mt-2 pl-11">
                            {movement.notes}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SuccessBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-12);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 250 });
    opacity.value = withSequence(
      withTiming(1, { duration: 250 }),
      withDelay(
        3500,
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished) runOnJS(dismissRef.current)();
        }),
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  function handleDismiss() {
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(dismissRef.current)();
    });
  }

  return (
    <Animated.View
      style={[
        style,
        {
          backgroundColor: "#16a34a",
          flexDirection: "row",
          alignItems: "center",
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 4,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
      ]}
    >
      <Ionicons name="checkmark-circle" size={18} color="#fff" />
      <Text
        style={{
          flex: 1,
          color: "#fff",
          fontSize: 14,
          fontWeight: "500",
          marginLeft: 8,
        }}
      >
        {message}
      </Text>
      <Pressable onPress={handleDismiss} hitSlop={8}>
        <Ionicons name="close" size={18} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

export default function StoreroomScreen() {
  const { staff } = useAuth();
  const { successMsg } = useLocalSearchParams<{ successMsg?: string }>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StoreroomItem | null>(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);

  const { data: items = [], isLoading, refetch } = useStoreroomItems(staff?.houseId);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const lowStock = items.filter((i) => Number(i.currentQuantity) <= 5);

  function dismissBanner() {
    router.setParams({ successMsg: "" });
  }

  function openDetails(item: StoreroomItem) {
    setSelectedItem(item);
    setIsDetailsModalVisible(true);
  }

  function closeDetails() {
    setIsDetailsModalVisible(false);
  }

  return (
    <View className="flex-1 bg-gray-50">
      {successMsg ? (
        <SuccessBanner message={successMsg} onDismiss={dismissBanner} />
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
          ListHeaderComponent={
            lowStock.length > 0 ? (
              <View className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-sm font-semibold text-orange-700 mb-1">
                  Estoque baixo ({lowStock.length}{" "}
                  {lowStock.length === 1 ? "item" : "itens"})
                </Text>
                {lowStock.map((i) => (
                  <Text key={i.id} className="text-xs text-orange-600">
                    • {i.name}: {formatQuantity(i.currentQuantity)} {i.unit}
                  </Text>
                ))}
              </View>
            ) : null
          }
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <Text className="text-center text-gray-500 text-sm py-8">
              Nenhum item cadastrado na dispensa.
            </Text>
          }
          renderItem={({ item }) => {
            const weeklyAverage = getWeeklyAverage(item);
            const hasWeeklyAverage = weeklyAverage > 0;

            return (
              <Pressable
                className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex-row items-center"
                onPress={() => openDetails(item)}
              >
                <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mr-3">
                  <Ionicons name="cube-outline" size={20} color="#16a34a" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">
                    {item.name}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Estoque: {formatQuantity(item.currentQuantity)} {item.unit}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Média: {hasWeeklyAverage ? `${formatQuantity(weeklyAverage)} ${item.unit}/sem.` : "sem média"}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Autonomia: {formatAutonomy(item)}
                  </Text>
                </View>
                <View className="items-end gap-2">
                  {Number(item.currentQuantity) <= 5 && (
                    <View className="bg-orange-50 rounded-full px-2 py-0.5">
                      <Text className="text-xs text-orange-600 font-medium">
                        Baixo
                      </Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <ItemDetailsModal
        item={selectedItem}
        visible={isDetailsModalVisible}
        onClose={closeDetails}
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
