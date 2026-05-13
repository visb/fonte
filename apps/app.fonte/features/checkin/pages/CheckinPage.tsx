import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSupportGroupCheckin } from '../hooks/useCheckin';

type ScanResult =
  | { kind: 'success'; groupName: string }
  | { kind: 'error'; message: string };

export function CheckinPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(true);
  const processingRef = useRef(false);

  const checkinMutation = useSupportGroupCheckin();

  async function handleBarcode({ data }: { data: string }) {
    if (!scanning || processingRef.current) return;
    processingRef.current = true;
    setScanning(false);

    try {
      const res = await checkinMutation.mutateAsync(data);
      setResult({ kind: 'success', groupName: res.relativeName });
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      const msg = anyErr?.response?.data?.message ?? 'QR code inválido ou reunião não encontrada.';
      setResult({ kind: 'error', message: typeof msg === 'string' ? msg : 'Erro ao registrar check-in.' });
    } finally {
      processingRef.current = false;
    }
  }

  function reset() {
    setResult(null);
    setScanning(true);
  }

  if (!permission) {
    return <View className="flex-1 items-center justify-center" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <Ionicons name="camera-outline" size={48} color="#9ca3af" />
        <Text className="text-base text-gray-700 text-center">
          Precisamos de acesso à câmera para escanear o QR code.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-violet-600 rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">Permitir câmera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (result) {
    return (
      <View className="flex-1 items-center justify-center gap-6 px-8 bg-gray-50">
        {result.kind === 'success' ? (
          <>
            <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center">
              <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
            </View>
            <View className="items-center gap-2">
              <Text className="text-xl font-bold text-gray-900">Check-in realizado!</Text>
              <Text className="text-sm text-gray-500 text-center">
                Sua presença foi registrada com sucesso.
              </Text>
            </View>
          </>
        ) : (
          <>
            <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center">
              <Ionicons name="close-circle" size={48} color="#dc2626" />
            </View>
            <View className="items-center gap-2">
              <Text className="text-xl font-bold text-gray-900">Erro no check-in</Text>
              <Text className="text-sm text-gray-500 text-center">{result.message}</Text>
            </View>
          </>
        )}
        <TouchableOpacity
          onPress={reset}
          className="bg-violet-600 rounded-xl px-8 py-3"
        >
          <Text className="text-white font-semibold">Escanear novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanning ? handleBarcode : undefined}
      />

      <View className="flex-1 items-center justify-center">
        <View className="w-64 h-64 border-2 border-white rounded-2xl" />
      </View>

      <View className="pb-12 items-center gap-2">
        <Text className="text-white text-base font-semibold">Aponte para o QR code</Text>
        <Text className="text-white/60 text-sm">do grupo de apoio</Text>
      </View>
    </View>
  );
}
