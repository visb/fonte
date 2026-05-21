import { Text, TouchableOpacity, View } from 'react-native';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'Erro ao carregar dados.',
  onRetry,
}: Props) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12 gap-3">
      <Text className="text-center text-red-600 text-sm">{message}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          className="border border-gray-300 rounded-lg px-4 py-2"
        >
          <Text className="text-sm text-gray-700">Tentar novamente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
