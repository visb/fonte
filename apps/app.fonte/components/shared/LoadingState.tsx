import { View, ActivityIndicator, Text } from 'react-native';

interface Props {
  message?: string;
}

export function LoadingState({ message }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-3">
      <ActivityIndicator size="large" color="#7c3aed" />
      {message && <Text className="text-sm text-gray-500">{message}</Text>}
    </View>
  );
}
