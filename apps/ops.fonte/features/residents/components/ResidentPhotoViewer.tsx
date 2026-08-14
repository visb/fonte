import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveAssetUrl } from '@/lib/api';

interface Props {
  visible: boolean;
  name: string;
  photoUrl?: string | null;
  photoThumbUrl?: string | null;
  onClose: () => void;
}

/**
 * Foto do filho em tela cheia (story 179).
 *
 * Extraído do `ResidentPhoto` para que a contagem abra o mesmo visualizador a
 * partir da thumb de 40px da lista — o expansor e o avatar estavam colados num
 * componente só, com tamanho fixo.
 *
 * A versão cheia (`photoUrl`) pode nunca ter sido baixada no aparelho: a lista
 * renderiza a thumb, então é ela que está no cache de imagem do SO. Se a cheia
 * falhar, o `onError` cai na thumb — foto pixelada reconhece um rosto no pátio,
 * retângulo vazio não. Sem nenhuma das duas o visualizador não abre.
 */
export function ResidentPhotoViewer({ visible, name, photoUrl, photoThumbUrl, onClose }: Props) {
  const fullUrl = resolveAssetUrl(photoUrl ?? photoThumbUrl);
  const thumbUrl = resolveAssetUrl(photoThumbUrl ?? photoUrl);
  const [failed, setFailed] = useState(false);

  // O visualizador da contagem é montado uma vez e reaproveitado por filho:
  // sem isso o fallback de um filho grudaria no próximo.
  useEffect(() => setFailed(false), [photoUrl, photoThumbUrl]);

  if (!fullUrl) return null;

  const uri = failed && thumbUrl ? thumbUrl : fullUrl;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/90 items-center justify-center" onPress={onClose}>
        <View className="w-full h-2/3">
          <Image
            source={{ uri }}
            className="w-full h-full"
            resizeMode="contain"
            onError={() => setFailed(true)}
          />
        </View>
        <TouchableOpacity
          accessibilityLabel="Fechar foto"
          onPress={onClose}
          className="absolute top-12 right-6 p-2"
        >
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-base mt-4">{name}</Text>
      </Pressable>
    </Modal>
  );
}
