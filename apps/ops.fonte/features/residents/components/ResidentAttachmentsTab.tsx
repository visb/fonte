import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveAssetUrl } from '@/lib/api';
import { useIsOnline } from '@/lib/offline/network';
import { OfflineNotice } from '@/components/shared/OfflineNotice';
import { useResidentAttachments } from '../hooks/useResidents';

interface Props {
  residentId: string;
}

/**
 * Story 175: a **lista** de anexos vive no store local e abre sem sinal; o
 * arquivo em si, não — baixar binário para o aparelho ficou fora de escopo
 * (volume de disco e exposição de documento). Sem rede, a linha continua
 * visível e o aviso explica por que ela não abre.
 */
export function ResidentAttachmentsTab({ residentId }: Props) {
  const { data: attachments = [], isLoading } = useResidentAttachments(residentId);
  const isOnline = useIsOnline();

  if (isLoading) return <ActivityIndicator color="#2563eb" className="py-8" />;

  if (attachments.length === 0) {
    return (
      <Text className="text-sm text-gray-500 text-center py-12">
        Nenhum anexo adicionado.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {!isOnline && (
        <OfflineNotice message="Precisa de conexão para abrir o arquivo. A lista está disponível offline." />
      )}
      {attachments.map((attachment) => (
        <TouchableOpacity
          key={attachment.id}
          disabled={!isOnline}
          onPress={() => {
            const url = resolveAssetUrl(attachment.fileUrl);
            if (url) Linking.openURL(url);
          }}
          className={`border border-gray-100 rounded-xl px-4 py-3 bg-white flex-row items-center ${!isOnline ? 'opacity-60' : ''}`}
        >
          <View className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center mr-3">
            <Ionicons name="document-outline" size={18} color="#6b7280" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
              {attachment.filename}
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              {new Date(attachment.createdAt).toLocaleDateString('pt-BR')}
            </Text>
          </View>
          <Ionicons name="open-outline" size={16} color="#9ca3af" />
        </TouchableOpacity>
      ))}
    </View>
  );
}
