import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { SyncLogoutNotice } from '@/features/sync/components/SyncLogoutNotice';

/**
 * "Sair" saiu do cabeçalho do dashboard e virou o último item do menu
 * (story 176). O aviso da story 169 vem junto: sair apaga a fila de envio, e
 * isso precisa estar escrito onde a ação está.
 */
export function MenuLogoutRow() {
  const { logout } = useAuth();

  return (
    <View>
      <View className="px-4 pb-4">
        <SyncLogoutNotice />
      </View>
      <TouchableOpacity
        testID="menu-item-logout"
        accessibilityRole="button"
        onPress={() => logout()}
        className="flex-row items-center px-4 py-3 bg-white border-y border-gray-100"
      >
        <View className="w-9 h-9 rounded-full items-center justify-center mr-3 bg-red-50">
          <Ionicons name="log-out-outline" size={18} color="#dc2626" />
        </View>
        <Text className="flex-1 text-base text-red-600">Sair</Text>
      </TouchableOpacity>
    </View>
  );
}
