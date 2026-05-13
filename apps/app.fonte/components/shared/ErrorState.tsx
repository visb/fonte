import { View, Text, TouchableOpacity } from 'react-native';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Erro ao carregar dados.', onRetry }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6">
      <Text className="text-sm text-red-600 text-center">{message}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          className="px-4 py-2 bg-violet-600 rounded-lg"
        >
          <Text className="text-white text-sm font-medium">Tentar novamente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
