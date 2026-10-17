import { View, Text, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { resolveAssetUrl } from "@/lib/api";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { ServantRankBadge } from "@/components/shared/ServantRankBadge";
import type { ServantRank } from "@fonte/types";

type Props = {
  name: string;
  houseName?: string;
  photoUrl?: string | null;
  /** Story 207: nível do servo logado; nulo → sem badge. */
  rank?: ServantRank | null;
};

/**
 * "Sair" saiu daqui na story 176: virou o último item da tab Menu, junto com o
 * aviso de que sair descarta a fila de envio.
 */
export function WelcomeHeader({ name, houseName, photoUrl, rank }: Props) {
  const photoUri = resolveAssetUrl(photoUrl);

  return (
    <View className="bg-[#272950] px-4 pt-4 pb-4 border-b border-gray-100">
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-3 flex-1">
          {photoUri ? (
            <Image source={{ uri: photoUri }} className="w-12 h-12 rounded-full" />
          ) : (
            <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="person" size={24} color="#fff" />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-white text-sm">Bem-vindo,</Text>
            <Text className="text-xl font-bold text-white">{name}</Text>
            {rank ? (
              <View className="mt-1">
                <ServantRankBadge rank={rank} />
              </View>
            ) : null}
            {houseName && (
              <Text className="text-sm text-white/70 mt-0.5">{houseName}</Text>
            )}
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <NotificationBell />
        </View>
      </View>
    </View>
  );
}
