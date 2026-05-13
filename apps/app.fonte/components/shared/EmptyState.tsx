import { View, Text } from 'react-native';

interface Props {
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message = 'Nenhum item encontrado.', icon }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-6">
      {icon}
      <Text className="text-sm text-gray-500 text-center">{message}</Text>
    </View>
  );
}
