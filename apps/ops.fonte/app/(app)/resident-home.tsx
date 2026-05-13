import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';

export default function ResidentHomeScreen() {
  const { resident, logout } = useAuth();

  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <View className="w-20 h-20 rounded-full bg-[#272950]/10 items-center justify-center mb-5">
        <Ionicons name="person-outline" size={36} color="#272950" />
      </View>
      <Text className="text-xl font-semibold text-gray-900 text-center">
        {resident?.name ?? ''}
      </Text>
      <Text className="text-sm text-gray-400 mt-1 mb-10 text-center">
        Use as abas abaixo para acessar mensagens e pedidos
      </Text>

      <TouchableOpacity
        onPress={logout}
        className="flex-row items-center gap-2 border border-gray-200 rounded-xl px-6 py-3"
      >
        <Ionicons name="log-out-outline" size={18} color="#6b7280" />
        <Text className="text-sm text-gray-500 font-medium">Sair</Text>
      </TouchableOpacity>
    </View>
  );
}
