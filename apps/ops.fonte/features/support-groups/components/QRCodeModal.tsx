import { useRef } from 'react';
import { Modal, TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import QRCodeGenerator from 'qrcode';

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  meetingId: string;
  groupName: string;
  date: string;
}

export function QRCodeModal({ visible, onClose, meetingId, groupName, date }: Props) {
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);
  const qrValue = `support-group-meeting:${meetingId}`;
  const basename = `qrcode-${groupName.replace(/\s+/g, '-')}-${date}`;

  function handleExport() {
    if (Platform.OS === 'web') {
      if (!qrRef.current) return;
      qrRef.current.toDataURL((data: string) => {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${data}`;
        link.download = `${basename}.png`;
        link.click();
      });
    } else {
      QRCodeGenerator.toString(qrValue, { type: 'svg', margin: 2 }).then(async (svg) => {
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

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/70">
        <View className="bg-white rounded-2xl p-8 items-center mx-8">
          <Text className="text-base font-semibold text-gray-900 mb-1">{groupName}</Text>
          <Text className="text-sm text-gray-500 mb-6">{formatDate(date)}</Text>
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
              onPress={onClose}
            >
              <Text className="text-sm font-medium text-gray-700">Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
