import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSyncQueueCount } from '../hooks/useSyncQueue';
import { pluralize } from '../utils';

/**
 * Badge da home (decisão 5): sem ele ninguém abre a tela de pendências e o
 * offline volta a ser caixa-preta. Some quando não há nada por sincronizar.
 */
export function SyncQueueBadge() {
  const count = useSyncQueueCount();
  if (count === 0) return null;

  return (
    <Pressable
      testID="sync-queue-badge"
      accessibilityLabel="Pendências de sincronização"
      // `as never`: os tipos de rota do expo-router são gerados no build (mesmo
      // tratamento das ações rápidas da home).
      onPress={() => router.push('/(app)/sync' as never)}
      className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex-row items-center mb-4"
    >
      <View className="w-9 h-9 rounded-full bg-amber-100 items-center justify-center mr-3">
        <Ionicons name="cloud-upload-outline" size={18} color="#b45309" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-amber-900">
          {pluralize(count, 'lançamento por sincronizar', 'lançamentos por sincronizar')}
        </Text>
        <Text className="text-xs text-amber-700 mt-0.5">Toque para ver a fila</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#b45309" />
    </Pressable>
  );
}
