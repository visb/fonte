import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveAssetUrl } from '@/lib/api';

interface Props {
  resident: {
    id: string;
    name: string;
    photoUrl?: string | null;
    photoThumbUrl?: string | null;
  };
  confirmed: boolean;
  // Added during this census; awaiting ADM approval. Auto-confirmed (present).
  pending?: boolean;
  onConfirm: () => void;
  onRemove: () => void;
  // Story 179: dois alvos de toque na linha — a foto expande, o resto abre os
  // detalhes. Os botões de confirmar/remover ficam fora dos dois: mirar num
  // botão e cair no modal (ou pior, confirmar presença sem querer) estraga a
  // contagem, que é uma passada única no pátio.
  onOpenDetails: () => void;
  onOpenPhoto: () => void;
}

export function CensusListItem({
  resident,
  confirmed,
  pending,
  onConfirm,
  onRemove,
  onOpenDetails,
  onOpenPhoto,
}: Props) {
  const thumbUrl = resolveAssetUrl(resident.photoThumbUrl ?? resident.photoUrl);
  return (
    <View
      className={`bg-white rounded-xl border px-4 py-3 flex-row items-center ${confirmed ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}
    >
      <TouchableOpacity
        accessibilityLabel={`Ver foto de ${resident.name}`}
        disabled={!thumbUrl}
        onPress={onOpenPhoto}
        className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3 overflow-hidden"
      >
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} className="w-10 h-10 rounded-full" />
        ) : (
          <Ionicons name="person-outline" size={20} color="#2563eb" />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel={`Detalhes de ${resident.name}`}
        onPress={onOpenDetails}
        className="flex-1"
      >
        <Text className="text-sm font-semibold text-gray-900">{resident.name}</Text>
        {pending ? (
          <View className="flex-row items-center mt-0.5">
            <View className="bg-amber-100 rounded-full px-2 py-0.5">
              <Text className="text-[10px] font-medium text-amber-700">Aguardando aprovação</Text>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>

      {pending ? (
        <View className="w-10 h-10 rounded-full items-center justify-center mr-2 bg-green-600">
          <Ionicons name="checkmark" size={20} color="#fff" />
        </View>
      ) : (
        <TouchableOpacity
          accessibilityLabel={`Confirmar ${resident.name}`}
          className={`w-10 h-10 rounded-full items-center justify-center mr-2 ${confirmed ? 'bg-green-600' : 'bg-green-50'}`}
          onPress={onConfirm}
        >
          <Ionicons name="checkmark" size={20} color={confirmed ? '#fff' : '#16a34a'} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        accessibilityLabel={`Remover ${resident.name}`}
        className="w-10 h-10 rounded-full items-center justify-center bg-red-50"
        onPress={onRemove}
      >
        <Ionicons name="trash-outline" size={18} color="#dc2626" />
      </TouchableOpacity>
    </View>
  );
}
