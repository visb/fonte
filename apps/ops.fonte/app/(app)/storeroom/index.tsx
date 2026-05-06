import { useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface StoreroomItem {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
}

function SuccessBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-12);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 250 });
    opacity.value = withSequence(
      withTiming(1, { duration: 250 }),
      withDelay(3500, withTiming(0, { duration: 300 }, (finished) => {
        if (finished) runOnJS(dismissRef.current)();
      })),
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
          backgroundColor: '#16a34a',
          flexDirection: 'row',
          alignItems: 'center',
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
      <Text style={{ flex: 1, color: '#fff', fontSize: 14, fontWeight: '500', marginLeft: 8 }}>
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

  const { data: items = [], isLoading } = useQuery<StoreroomItem[]>({
    queryKey: ['storeroom-items', staff?.houseId],
    queryFn: () =>
      api.get(`/storerooms/items?houseId=${staff?.houseId}`).then((r) => r.data),
    enabled: !!staff?.houseId,
  });

  const lowStock = items.filter((i) => Number(i.currentQuantity) <= 5);

  function dismissBanner() {
    router.setParams({ successMsg: '' });
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
          ListHeaderComponent={
            lowStock.length > 0 ? (
              <View className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-sm font-semibold text-orange-700 mb-1">
                  Estoque baixo ({lowStock.length} {lowStock.length === 1 ? 'item' : 'itens'})
                </Text>
                {lowStock.map((i) => (
                  <Text key={i.id} className="text-xs text-orange-600">
                    • {i.name}: {Number(i.currentQuantity)} {i.unit}
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
          renderItem={({ item }) => (
            <View className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mr-3">
                <Ionicons name="cube-outline" size={20} color="#16a34a" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">{item.name}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  {Number(item.currentQuantity)} {item.unit}
                </Text>
              </View>
              {Number(item.currentQuantity) <= 5 && (
                <View className="bg-orange-50 rounded-full px-2 py-0.5">
                  <Text className="text-xs text-orange-600 font-medium">Baixo</Text>
                </View>
              )}
            </View>
          )}
        />
      )}

      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-green-600 w-14 h-14 rounded-full items-center justify-center shadow-md"
        onPress={() => router.push('/(app)/storeroom/movement')}
      >
        <Ionicons name="swap-vertical" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
