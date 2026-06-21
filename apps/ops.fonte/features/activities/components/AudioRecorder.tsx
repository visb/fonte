import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { getErrorMessage } from '@/lib/errors';
import type { PickedAttachment } from '@/features/activities/hooks/useActivities';
import {
  AUDIO_MAX_DURATION_SECONDS,
  formatDuration,
} from '@/features/activities/lib/attachments';

interface Props {
  onRecorded: (att: PickedAttachment) => void;
  uploading: boolean;
}

/**
 * Gravador de áudio (story 74) no ops.fonte: usa `expo-av` Recording com timer e
 * auto-stop em 2:00. Pede permissão de microfone; ao parar, monta um
 * `PickedAttachment` com a uri local, mimetype e a duração medida. Salva o
 * formato nativo do device — sem transcodação.
 */
export function AudioRecorder({ onRecorded, uploading }: Props) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = async () => {
    stopTimer();
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    setRecording(false);
    try {
      const status = await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) return;
      const durationSeconds = (status.durationMillis ?? 0) / 1000;
      // expo-av grava .m4a (AAC) por padrão no preset HIGH_QUALITY.
      const isWebm = uri.endsWith('.webm');
      onRecorded({
        uri,
        mimeType: isWebm ? 'audio/webm' : 'audio/m4a',
        name: isWebm ? `gravacao-${Date.now()}.webm` : `gravacao-${Date.now()}.m4a`,
        durationSeconds,
      });
    } catch (e) {
      Alert.alert('Erro', getErrorMessage(e, 'Falha ao finalizar a gravação.'));
    }
  };

  const start = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Permita o acesso ao microfone para gravar áudio.',
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 0.5;
          if (next >= AUDIO_MAX_DURATION_SECONDS) void stop();
          return next;
        });
      }, 500);
    } catch (e) {
      Alert.alert('Erro', getErrorMessage(e, 'Não foi possível acessar o microfone.'));
    }
  };

  if (recording) {
    return (
      <View className="flex-row items-center mt-1">
        <TouchableOpacity
          className="bg-red-600 rounded-lg px-3 py-2 mr-2"
          onPress={stop}
          accessibilityRole="button"
          accessibilityLabel="Parar gravação"
        >
          <Text className="text-sm font-medium text-white">⏹️ Parar</Text>
        </TouchableOpacity>
        <Text className="text-xs text-gray-500">
          {formatDuration(elapsed)} / {formatDuration(AUDIO_MAX_DURATION_SECONDS)}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      className="bg-gray-100 rounded-lg px-3 py-2 mt-1 self-start"
      onPress={start}
      disabled={uploading}
      style={{ opacity: uploading ? 0.5 : 1 }}
      accessibilityRole="button"
      accessibilityLabel="Gravar áudio"
    >
      <Text className="text-sm font-medium text-gray-700">🎙️ Gravar áudio</Text>
    </TouchableOpacity>
  );
}
