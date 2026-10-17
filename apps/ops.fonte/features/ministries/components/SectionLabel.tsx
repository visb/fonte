import { Text } from 'react-native';

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-2">
      {children}
    </Text>
  );
}
