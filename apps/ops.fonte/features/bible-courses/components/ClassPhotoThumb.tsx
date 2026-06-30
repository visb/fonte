import { Alert, Image, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BibleCourseClassPhoto } from '@fonte/api-client';

interface Props {
  photo: BibleCourseClassPhoto;
  onDelete: (photoId: string) => void;
  deleting: boolean;
}

/**
 * Miniatura de uma foto da galeria da turma (story 92): exibe a imagem e oferece
 * excluir com confirmação (Alert). Item extraído do grid da galeria.
 */
export function ClassPhotoThumb({ photo, onDelete, deleting }: Props) {
  const confirmDelete = () => {
    Alert.alert('Remover foto', 'Remover esta foto da turma?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => onDelete(photo.id) },
    ]);
  };

  return (
    <View className="relative w-1/3 p-1">
      <Image
        source={{ uri: photo.fileUrl }}
        className="w-full aspect-square rounded-md bg-gray-100"
        accessibilityLabel={photo.fileName}
      />
      <TouchableOpacity
        onPress={confirmDelete}
        disabled={deleting}
        accessibilityRole="button"
        accessibilityLabel={`Remover foto ${photo.fileName}`}
        className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5"
        style={{ opacity: deleting ? 0.5 : 1 }}
      >
        <Ionicons name="trash" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
