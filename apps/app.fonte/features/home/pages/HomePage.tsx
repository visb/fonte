import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useRelativeMe } from '../hooks/useRelativeMe';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View className="flex-row gap-2 py-1">
      <Text className="text-sm text-gray-500 w-28 shrink-0">{label}</Text>
      <Text className="text-sm text-gray-900 flex-1">{value || '—'}</Text>
    </View>
  );
}

export function HomePage() {
  const { logout } = useAuth();
  const { data: me, isLoading, isError, refetch } = useRelativeMe();

  if (isLoading) return <LoadingState />;
  if (isError || !me) return <ErrorState onRetry={refetch} />;

  const photoUri = api.photoUrl(me.photoUrl);

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-violet-700 px-5 pt-8 pb-10">
        <View className="flex-row items-center gap-3">
          {photoUri ? (
            <Image source={{ uri: photoUri }} className="w-14 h-14 rounded-full" />
          ) : (
            <View className="w-14 h-14 rounded-full bg-violet-500 items-center justify-center">
              <Ionicons name="person" size={28} color="#fff" />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-xl font-bold text-white">{me.name}</Text>
            {me.relationship && (
              <Text className="text-violet-200 text-sm">{me.relationship}</Text>
            )}
          </View>
          <TouchableOpacity onPress={logout} accessibilityLabel="Sair" className="p-2">
            <Ionicons name="log-out-outline" size={22} color="#c4b5fd" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="px-4 -mt-5 space-y-4 pb-8">
        <View className="bg-white rounded-2xl shadow-sm p-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Acolhido
          </Text>
          <InfoRow label="Nome" value={me.residentName} />
          <InfoRow label="Casa" value={me.houseName} />
        </View>

        <View className="bg-white rounded-2xl shadow-sm p-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Informações da Casa
          </Text>
          <InfoRow label="Endereço" value={me.houseAddress} />
          {me.houseCity && (
            <InfoRow label="Cidade" value={me.houseCity} />
          )}
          <InfoRow label="Telefone" value={me.housePhone} />
        </View>

        {(me.coordinatorName || me.coordinatorPhone) && (
          <View className="bg-white rounded-2xl shadow-sm p-4">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Coordenador
            </Text>
            <InfoRow label="Nome" value={me.coordinatorName} />
            <InfoRow label="Telefone" value={me.coordinatorPhone} />
          </View>
        )}

        {me.phone && (
          <View className="bg-white rounded-2xl shadow-sm p-4">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Meu contato
            </Text>
            <InfoRow label="Telefone" value={me.phone} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
