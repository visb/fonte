import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "@/lib/auth";

type Props = {
  name: string;
  houseName?: string;
};

export function WelcomeHeader({ name, houseName }: Props) {
  const { logout } = useAuth();

  return (
    <View className="bg-[#272950] px-4 pt-6 pb-4 border-b border-gray-100">
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="text-white text-sm">Bem-vindo,</Text>
          <Text className="text-2xl font-bold text-white">{name}</Text>
          {houseName && (
            <Text className="text-sm text-white mt-0.5">{houseName}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={logout}
          className="mt-1 px-3 py-1.5 rounded-lg border border-white/30 bg-white/10"
        >
          <Text className="text-white text-sm font-medium">Sair</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
