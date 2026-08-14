import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

type Props = {
  label: string;
  children: ReactNode;
};

export function MenuSection({ label, children }: Props) {
  return (
    <View className="mt-6">
      <Text className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </Text>
      <View className="border-t border-gray-100">{children}</View>
    </View>
  );
}
