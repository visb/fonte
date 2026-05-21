import { ActivityIndicator, View } from 'react-native';

interface Props {
  color?: string;
}

export function LoadingState({ color = '#2563eb' }: Props) {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" color={color} />
    </View>
  );
}
