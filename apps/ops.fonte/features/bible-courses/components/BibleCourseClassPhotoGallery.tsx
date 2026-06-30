import { Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import {
  useBibleCourseClassPhotos,
  useUploadBibleCourseClassPhoto,
  useDeleteBibleCourseClassPhoto,
  type PickedClassPhoto,
} from '../hooks/useBibleCoursePhotos';
import { ClassPhotoThumb } from './ClassPhotoThumb';

interface Props {
  classId: string;
}

/**
 * Galeria de fotos da turma no ops.fonte (story 92): grid de miniaturas + botão
 * de upload a partir da galeria/câmera do device + exclusão individual. Estados
 * via componentes compartilhados; erros via getErrorMessage.
 */
export function BibleCourseClassPhotoGallery({ classId }: Props) {
  const { data: photos = [], isLoading, isError, refetch } =
    useBibleCourseClassPhotos(classId);
  const uploadMutation = useUploadBibleCourseClassPhoto(classId);
  const deleteMutation = useDeleteBibleCourseClassPhoto(classId);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    const picked: PickedClassPhoto = {
      uri: a.uri,
      mimeType: a.mimeType ?? 'image/jpeg',
      name: a.fileName ?? 'foto.jpg',
    };
    uploadMutation.mutate(picked);
  };

  return (
    <View className="mt-2">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-base font-semibold text-gray-800">Fotos da turma</Text>
        <TouchableOpacity
          onPress={pickImage}
          disabled={uploadMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Adicionar foto"
          className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2"
          style={{ opacity: uploadMutation.isPending ? 0.5 : 1 }}
        >
          <Ionicons name="image" size={16} color="#374151" />
          <Text className="text-sm font-medium text-gray-700 ml-1.5">
            {uploadMutation.isPending ? 'Enviando...' : 'Adicionar foto'}
          </Text>
        </TouchableOpacity>
      </View>

      {uploadMutation.isError && (
        <Text className="text-xs text-red-600 mb-1">
          {getErrorMessage(uploadMutation.error, 'Erro ao enviar a foto.')}
        </Text>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : photos.length === 0 ? (
        <EmptyState message="Nenhuma foto nesta turma." />
      ) : (
        <View className="flex-row flex-wrap -m-1">
          {photos.map((photo) => (
            <ClassPhotoThumb
              key={photo.id}
              photo={photo}
              onDelete={(id) => deleteMutation.mutate(id)}
              deleting={deleteMutation.isPending}
            />
          ))}
        </View>
      )}
    </View>
  );
}
