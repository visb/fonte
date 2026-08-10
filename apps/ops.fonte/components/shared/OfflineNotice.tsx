import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Aviso das ações que **exigem rede** (story 171, decisão 4).
 *
 * Mensagens, wishlist, grupos de apoio e curso bíblico dependem de terceiros em
 * tempo real e ficam de fora da fila (decisão 1 do epic 167). Sem sinal a ação
 * é desabilitada e este aviso explica o porquê — o operador precisa saber que
 * não adianta insistir, em vez de levar um erro genérico de axios na tela.
 */
interface Props {
  /** Frase curta e específica da ação ("Precisa de conexão para enviar mensagens."). */
  message?: string;
}

export function OfflineNotice({ message = 'Precisa de conexão para esta ação.' }: Props) {
  return (
    <View
      testID="offline-notice"
      className="flex-row items-center gap-2 bg-gray-100 rounded-lg px-3 py-2"
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#6b7280" />
      <Text className="text-xs text-gray-500 flex-1">{message}</Text>
    </View>
  );
}
