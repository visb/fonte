import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { resolveAssetUrl } from '@/lib/api';
import { useResidentById } from '@/features/residents/hooks/useResidents';
import { ResidentPhotoViewer } from '@/features/residents/components/ResidentPhotoViewer';
import {
  censusStatusColor,
  censusStatusLabel,
  formatBirthDate,
  formatDate,
} from '../lib/residentDetails';

export interface CensusResidentSummary {
  id: string;
  name: string;
  status: string;
  entryDate: string | null;
  photoUrl?: string | null;
  photoThumbUrl?: string | null;
}

interface Props {
  visible: boolean;
  resident: CensusResidentSummary | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="py-2.5 border-b border-gray-100 flex-row">
      <Text className="text-sm text-gray-500 w-32">{label}</Text>
      <Text className="text-sm text-gray-900 flex-1">{value || '—'}</Text>
    </View>
  );
}

/**
 * Detalhes do filho durante a contagem (story 179) — só leitura.
 *
 * Abre **na hora** com o que a lista da contagem já tem em mãos (foto, nome,
 * situação, entrada) e enriquece com a ficha (`useResidentById`) quando ela
 * existir — no store local (story 175) ou por rede. Sem sinal e sem ficha em
 * disco, o bloco extra simplesmente não aparece: `isLoading`/`error` aqui não
 * são falha, são "ainda não temos". Nada de spinner bloqueante nem `ErrorState`
 * na cara do operador no meio do pátio (invariante offline-first do CLAUDE.md).
 *
 * Confirmar e remover seguem exclusivamente nos botões da linha: um caminho por
 * ação, sem duplicar a lógica de contagem.
 */
export function ResidentDetailModal({ visible, resident, onClose }: Props) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const { data } = useResidentById(resident?.id, { enabled: visible });

  const thumbUrl = resolveAssetUrl(resident?.photoThumbUrl ?? resident?.photoUrl);
  const status = resident?.status ?? '';

  function handleOpenFullProfile() {
    if (!resident) return;
    onClose();
    router.push(`/(app)/residents/${resident.id}` as never);
  }

  return (
    <>
      <Modal visible={visible && !!resident} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={onClose} />
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: '85%' }}>
            <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
              <Text className="text-base font-semibold text-gray-900 flex-1">
                Detalhes do filho
              </Text>
              <Pressable accessibilityLabel="Fechar detalhes" onPress={onClose}>
                <Ionicons name="close" size={20} color="#4b5563" />
              </Pressable>
            </View>

            <ScrollView className="px-5" contentContainerStyle={{ paddingVertical: 16 }}>
              <View className="items-center">
                <TouchableOpacity
                  accessibilityLabel="Ampliar foto"
                  disabled={!thumbUrl}
                  onPress={() => setPhotoOpen(true)}
                  className="w-24 h-24 rounded-full bg-blue-50 items-center justify-center overflow-hidden"
                >
                  {thumbUrl ? (
                    <Image source={{ uri: thumbUrl }} className="w-24 h-24 rounded-full" />
                  ) : (
                    <Ionicons name="person-outline" size={40} color="#2563eb" />
                  )}
                </TouchableOpacity>
                <Text className="text-base font-semibold text-gray-900 mt-3 text-center">
                  {resident?.name}
                </Text>
                <View
                  className="rounded-full px-2.5 py-1 mt-1.5"
                  style={{ backgroundColor: `${censusStatusColor(status)}20` }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: censusStatusColor(status) }}
                  >
                    {censusStatusLabel(status)}
                  </Text>
                </View>
              </View>

              <View className="mt-4">
                <Row label="Entrada" value={formatDate(resident?.entryDate)} />
                {data ? (
                  <>
                    <Row label="Nascimento" value={formatBirthDate(data.birthDate)} />
                    <Row label="Telefone" value={data.contactPhone} />
                  </>
                ) : null}
              </View>
            </ScrollView>

            <View className="px-5 py-4 border-t border-gray-100">
              <TouchableOpacity
                accessibilityLabel="Ver ficha completa"
                className="rounded-xl py-3 items-center bg-blue-600"
                onPress={handleOpenFullProfile}
              >
                <Text className="text-sm font-medium text-white">Ver ficha completa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ResidentPhotoViewer
        visible={photoOpen}
        name={resident?.name ?? ''}
        photoUrl={resident?.photoUrl}
        photoThumbUrl={resident?.photoThumbUrl}
        onClose={() => setPhotoOpen(false)}
      />
    </>
  );
}
