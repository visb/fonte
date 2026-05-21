import { Text, View } from 'react-native';
import type { ReactNode } from 'react';

interface Props {
  message: string;
  children?: ReactNode;
}

export function EmptyState({ message, children }: Props) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <Text className="text-center text-gray-500 text-sm">{message}</Text>
      {children}
    </View>
  );
}
