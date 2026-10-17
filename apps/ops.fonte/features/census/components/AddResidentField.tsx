import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

interface Props {
  label: string;
  error?: string;
  children: ReactNode;
}

/** Rótulo + campo + erro do formulário "Adicionar filho". */
export function AddResidentField({ label, error, children }: Props) {
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">{label}</Text>
      {children}
      {error ? <Text className="text-xs text-red-600 mt-1">{error}</Text> : null}
    </View>
  );
}
