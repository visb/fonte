import { Image, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { resolveAssetUrl } from '@/lib/api';
import { ServantRankBadge } from '@/components/shared/ServantRankBadge';

/**
 * Cabeçalho do menu: quem está logado + o caminho para a tela de perfil, que
 * deixou de ter tab própria (story 176) mas continua existindo como rota.
 */
export function MenuProfileCard() {
  const { staff, resident, isResident } = useAuth();

  const name = (isResident ? resident?.name : staff?.name) ?? '—';
  const subtitle = isResident
    ? 'Filho'
    : (staff?.house?.name ?? staff?.supportGroup?.name ?? '');
  // Story 207: nível do servo logado; no modo Resident não aparece.
  const rank = isResident ? null : (staff?.rank ?? null);
  const photoUri = resolveAssetUrl(
    (isResident ? resident?.photoUrl : staff?.photoUrl) ?? null,
  );

  return (
    <View className="bg-[#272950] px-4 pt-4 pb-5">
      <View className="flex-row items-center gap-3">
        {photoUri ? (
          <Image
            testID="menu-profile-photo"
            source={{ uri: photoUri }}
            className="w-14 h-14 rounded-full"
          />
        ) : (
          <View className="w-14 h-14 rounded-full bg-white/20 items-center justify-center">
            <Ionicons name="person" size={28} color="#fff" />
          </View>
        )}
        <View className="flex-1">
          <Text className="text-xl font-bold text-white">{name}</Text>
          {rank ? (
            <View className="mt-1">
              <ServantRankBadge rank={rank} />
            </View>
          ) : null}
          {!!subtitle && <Text className="text-sm text-white/70 mt-0.5">{subtitle}</Text>}
        </View>
      </View>
      <TouchableOpacity
        testID="menu-edit-profile"
        accessibilityRole="button"
        onPress={() => router.push('/(app)/profile' as never)}
        className="mt-4 self-start px-3 py-1.5 rounded-lg border border-white/30 bg-white/10"
      >
        <Text className="text-white text-sm font-medium">Editar perfil</Text>
      </TouchableOpacity>
    </View>
  );
}
