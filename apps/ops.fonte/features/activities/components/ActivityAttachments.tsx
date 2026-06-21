import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { ActivityAttachment } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import {
  formatFileSize,
  validateAttachment,
  validateAudioDuration,
  isAudioMimetype,
  ATTACHMENT_ALLOWED_MIMETYPES,
  ATTACHMENT_AUDIO_MIMETYPES,
} from '@/features/activities/lib/attachments';
import type { PickedAttachment } from '@/features/activities/hooks/useActivities';
import { AudioPlayer } from './AudioPlayer';
import { AudioRecorder } from './AudioRecorder';

interface Props {
  attachments: ActivityAttachment[];
  onUpload: (att: PickedAttachment) => void;
  onDelete: (attachmentId: string) => void;
  uploading: boolean;
  deleting: boolean;
  uploadError?: unknown;
  uploadLabel?: string;
}

/**
 * Anexos (atividade ou comentário) no ops.fonte (story 73): lista com download
 * (abre a URL) + excluir condicional (backend marca `canDelete`), e botões de
 * anexar via galeria de imagem ou seletor de documento. Valida tipo/tamanho no
 * cliente; o backend é a autoridade.
 */
export function ActivityAttachments({
  attachments,
  onUpload,
  onDelete,
  uploading,
  deleting,
  uploadError,
  uploadLabel = 'Anexar',
}: Props) {
  const handlePicked = (att: PickedAttachment, size?: number) => {
    const message = validateAttachment(att.mimeType, size);
    if (message) {
      Alert.alert('Anexo inválido', message);
      return;
    }
    if (isAudioMimetype(att.mimeType)) {
      const durationError = validateAudioDuration(att.durationSeconds ?? undefined);
      if (durationError) {
        Alert.alert('Anexo inválido', durationError);
        return;
      }
    }
    onUpload(att);
  };

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      type: ATTACHMENT_AUDIO_MIMETYPES as unknown as string[],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    handlePicked(
      {
        uri: a.uri,
        mimeType: a.mimeType ?? 'audio/mpeg',
        name: a.name,
      },
      a.size ?? undefined,
    );
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    handlePicked(
      {
        uri: a.uri,
        mimeType: a.mimeType ?? 'image/jpeg',
        name: a.fileName ?? 'foto.jpg',
      },
      a.fileSize,
    );
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      type: ATTACHMENT_ALLOWED_MIMETYPES as unknown as string[],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    handlePicked(
      {
        uri: a.uri,
        mimeType: a.mimeType ?? 'application/octet-stream',
        name: a.name,
      },
      a.size ?? undefined,
    );
  };

  return (
    <View className="mt-2">
      {attachments.map((att) =>
        att.fileType === 'audio' ? (
          <View
            key={att.id}
            className="bg-white rounded-lg px-3 py-2 mb-1.5 border border-gray-100"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 mr-2">
                <Text className="mr-2">🎵</Text>
                <Text className="text-sm text-gray-800 flex-1" numberOfLines={1}>
                  {att.fileName}
                </Text>
              </View>
              {att.canDelete && (
                <TouchableOpacity
                  onPress={() => onDelete(att.id)}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir anexo ${att.fileName}`}
                >
                  <Text className="text-xs font-medium text-red-600">Excluir</Text>
                </TouchableOpacity>
              )}
            </View>
            <AudioPlayer uri={att.fileUrl} durationSeconds={att.durationSeconds} />
          </View>
        ) : (
          <View
            key={att.id}
            className="flex-row items-center justify-between bg-white rounded-lg px-3 py-2 mb-1.5 border border-gray-100"
          >
            <TouchableOpacity
              className="flex-row items-center flex-1 mr-2"
              onPress={() => Linking.openURL(att.fileUrl)}
              accessibilityRole="link"
              accessibilityLabel={`Abrir anexo ${att.fileName}`}
            >
              <Text className="mr-2">{att.fileType === 'image' ? '🖼️' : '📄'}</Text>
              <Text className="text-sm text-gray-800 flex-1" numberOfLines={1}>
                {att.fileName}
              </Text>
              <Text className="text-xs text-gray-400 ml-2">
                {formatFileSize(att.sizeBytes)}
              </Text>
            </TouchableOpacity>
            {att.canDelete && (
              <TouchableOpacity
                onPress={() => onDelete(att.id)}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel={`Excluir anexo ${att.fileName}`}
              >
                <Text className="text-xs font-medium text-red-600">Excluir</Text>
              </TouchableOpacity>
            )}
          </View>
        ),
      )}

      <View className="flex-row mt-1">
        <TouchableOpacity
          className="bg-gray-100 rounded-lg px-3 py-2 mr-2"
          onPress={pickImage}
          disabled={uploading}
          style={{ opacity: uploading ? 0.5 : 1 }}
          accessibilityRole="button"
          accessibilityLabel={`${uploadLabel} imagem`}
        >
          <Text className="text-sm font-medium text-gray-700">
            {uploading ? 'Enviando...' : `${uploadLabel} imagem`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-gray-100 rounded-lg px-3 py-2 mr-2"
          onPress={pickDocument}
          disabled={uploading}
          style={{ opacity: uploading ? 0.5 : 1 }}
          accessibilityRole="button"
          accessibilityLabel={`${uploadLabel} documento`}
        >
          <Text className="text-sm font-medium text-gray-700">
            {uploading ? 'Enviando...' : `${uploadLabel} documento`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-gray-100 rounded-lg px-3 py-2"
          onPress={pickAudio}
          disabled={uploading}
          style={{ opacity: uploading ? 0.5 : 1 }}
          accessibilityRole="button"
          accessibilityLabel={`${uploadLabel} áudio`}
        >
          <Text className="text-sm font-medium text-gray-700">
            {uploading ? 'Enviando...' : `${uploadLabel} áudio`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Gravação de áudio pelo microfone (story 74). */}
      <AudioRecorder onRecorded={onUpload} uploading={uploading} />

      {uploadError != null && (
        <Text className="text-xs text-red-600 mt-1">
          {getErrorMessage(uploadError, 'Erro ao enviar o anexo.')}
        </Text>
      )}
    </View>
  );
}
