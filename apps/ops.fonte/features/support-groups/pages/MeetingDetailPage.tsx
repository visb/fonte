import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCodeGenerator from 'qrcode';
import type { SupportGroupCheckin } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { useMeetingDetail, useAddCheckin, useRemoveCheckin } from '../hooks/useSupportGroups';
import { useResidentsByHouse } from '@/features/residents/hooks/useResidents';

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export function MeetingDetailPage() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const { staff } = useAuth();

  const [qrVisible, setQrVisible] = useState(false);
  const [search, setSearch] = useState('');
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  const { data: meeting, isLoading } = useMeetingDetail(meetingId);
  const { data: residents = [] } = useResidentsByHouse(staff?.houseId ?? undefined);
  const addCheckin = useAddCheckin(meetingId ?? '');
  const removeCheckin = useRemoveCheckin(meetingId ?? '');

  const checkedInIds = useMemo(
    () => new Set((meeting?.checkins ?? []).map((c: SupportGroupCheckin) => c.residentId)),
    [meeting?.checkins],
  );

  const filteredResidents = useMemo(
    () => residents.filter(
      (r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) &&
        !checkedInIds.has(r.id),
    ),
    [residents, search, checkedInIds],
  );

  function handleExport() {
    if (!meeting) return;
    const basename = `qrcode-${meeting.supportGroupName.replace(/\s+/g, '-')}-${meeting.date}`;
    if (Platform.OS === 'web') {
      if (!qrRef.current) return;
      qrRef.current.toDataURL((data: string) => {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${data}`;
        link.download = `${basename}.png`;
        link.click();
      });
    } else {
      QRCodeGenerator.toString(`support-group-meeting:${meeting.id}`, { type: 'svg', margin: 2 }).then(async (svg) => {
        const fileUri = (FileSystem.cacheDirectory ?? '') + `${basename}.svg`;
        await FileSystem.writeAsStringAsync(fileUri, svg, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/svg+xml',
          dialogTitle: 'Salvar QR Code',
          UTI: 'public.svg-image',
        });
      });
    }
  }

  function handleCheckin(residentId: string) {
    addCheckin.mutate({ residentId });
    setSearch('');
  }

  function handleRemoveCheckin(checkinId: string) {
    removeCheckin.mutate(checkinId);
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Reunião' }} />
        <View className="flex-1 items-center justify-center bg-gray-50">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  if (!meeting) {
    return (
      <>
        <Stack.Screen options={{ title: 'Reunião' }} />
        <View className="flex-1 items-center justify-center bg-gray-50">
          <Text className="text-gray-500">Reunião não encontrada.</Text>
        </View>
      </>
    );
  }

  const qrValue = `support-group-meeting:${meeting.id}`;

  return (
    <>
      <Stack.Screen
        options={{
          title: meeting.supportGroupName,
          headerStyle: { backgroundColor: '#272950' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />

      <View className="flex-1 bg-gray-50">
        <FlatList
          data={meeting.checkins}
          keyExtractor={(item: SupportGroupCheckin) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          ListHeaderComponent={
            <View className="gap-4">
              {/* Meeting info */}
              <View className="bg-white rounded-xl border border-gray-200 p-4">
                <Text className="text-base font-semibold text-gray-900">{meeting.supportGroupName}</Text>
                <Text className="text-sm text-gray-500 mt-0.5">{formatDate(meeting.date)}</Text>
                {meeting.notes ? (
                  <Text className="text-sm text-gray-400 mt-1 italic">{meeting.notes}</Text>
                ) : null}
              </View>

              {/* QR Code button */}
              <TouchableOpacity
                className="bg-indigo-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
                onPress={() => setQrVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="qr-code-outline" size={20} color="#fff" />
                <Text className="text-sm font-semibold text-white">Exibir QR Code para Checkin</Text>
              </TouchableOpacity>

              {/* Manual checkin */}
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2">Registrar presença manualmente</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white"
                  placeholder="Buscar pelo nome do filho..."
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <View className="border border-gray-200 rounded-xl overflow-hidden mt-1 bg-white">
                    {filteredResidents.length === 0 ? (
                      <Text className="text-sm text-gray-400 px-4 py-3">Nenhum resultado.</Text>
                    ) : (
                      filteredResidents.slice(0, 5).map((r) => (
                        <TouchableOpacity
                          key={r.id}
                          className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between"
                          onPress={() => handleCheckin(r.id)}
                          disabled={addCheckin.isPending}
                        >
                          <Text className="text-sm text-gray-900">{r.name}</Text>
                          <Ionicons name="add-circle-outline" size={18} color="#2563eb" />
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>

              {/* Checkins header */}
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-gray-700">
                  Presenças ({meeting.checkins.length})
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text className="text-sm text-gray-400 text-center py-4">
              Nenhuma família registrada ainda.
            </Text>
          }
          renderItem={({ item }: { item: SupportGroupCheckin }) => (
            <View className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-row items-center">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900">{item.residentName}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {new Date(item.checkedInAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveCheckin(item.id)}
                disabled={removeCheckin.isPending}
                className="p-1"
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        />
      </View>

      {/* QR Code Modal */}
      <Modal visible={qrVisible} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/70">
          <View className="bg-white rounded-2xl p-8 items-center mx-8">
            <Text className="text-base font-semibold text-gray-900 mb-1">{meeting.supportGroupName}</Text>
            <Text className="text-sm text-gray-500 mb-6">{formatDate(meeting.date)}</Text>
            <QRCode value={qrValue} size={220} getRef={(ref) => { qrRef.current = ref; }} />
            <Text className="text-xs text-gray-400 mt-4 text-center">
              Mostre este QR Code para as famílias realizarem o checkin
            </Text>
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center gap-1.5 bg-indigo-100 rounded-xl py-3"
                onPress={handleExport}
              >
                <Ionicons name="download-outline" size={16} color="#4338ca" />
                <Text className="text-sm font-medium text-indigo-700">Exportar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
                onPress={() => setQrVisible(false)}
              >
                <Text className="text-sm font-medium text-gray-700">Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
