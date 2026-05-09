import { View, Text } from "react-native";

type Props = {
  name: string;
  houseName?: string;
};

export function WelcomeHeader({ name, houseName }: Props) {
  return (
    <View className="bg-[#272950] px-4 pt-6 pb-4 border-b border-gray-100">
      <Text className="text-white text-sm">Bem-vindo,</Text>
      <Text className="text-2xl font-bold text-white">{name}</Text>
      {houseName && (
        <Text className="text-sm text-white mt-0.5">{houseName}</Text>
      )}
    </View>
  );
}
