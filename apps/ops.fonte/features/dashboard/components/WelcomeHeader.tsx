import { View, Text, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { resolveAssetUrl } from "@/lib/api";

type Props = {
  name: string;
  houseName?: string;
  photoUrl?: string | null;
};

export function WelcomeHeader({ name, houseName, photoUrl }: Props) {
  const { logout } = useAuth();
  const photoUri = resolveAssetUrl(photoUrl);

  return (
    <View className="bg-[#272950] px-4 pt-6 pb-4 border-b border-gray-100">
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
            {houseName && (
              <Text className="text-sm text-white/70 mt-0.5">{houseName}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={logout}
          className="ml-2 px-3 py-1.5 rounded-lg border border-white/30 bg-white/10"
        >
          <Text className="text-white text-sm font-medium">Sair</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
