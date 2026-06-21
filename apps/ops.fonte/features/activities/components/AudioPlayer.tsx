import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { formatDuration } from '@/features/activities/lib/attachments';

const SPEEDS = [1, 1.5, 2] as const;

interface Props {
  uri: string;
  /** Duração conhecida (segundos) vinda do backend; fallback para o status do som. */
  durationSeconds?: number | null;
}

/**
 * Player de áudio (story 74) no ops.fonte para anexos `file_type = audio`:
 * play/pause, tempo e seletor de velocidade 1x/1.5x/2x via `setRateAsync`. Usa
 * `expo-av` `Sound`; libera o recurso ao desmontar.
 */
export function AudioPlayer({ uri, durationSeconds }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPlaying(status.isPlaying);
    setPosition(status.positionMillis / 1000);
    if (status.durationMillis) setDuration(status.durationMillis / 1000);
    if (status.didJustFinish) setPlaying(false);
  };

  const ensureLoaded = async (): Promise<Audio.Sound> => {
    if (soundRef.current) return soundRef.current;
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { rate: speed, shouldCorrectPitch: true },
      onStatus,
    );
    soundRef.current = sound;
    return sound;
  };

  const toggle = async () => {
    const sound = await ensureLoaded();
    if (playing) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const cycleSpeed = async () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    await soundRef.current?.setRateAsync(next, true);
  };

  return (
    <View className="flex-row items-center bg-gray-50 rounded-lg px-2 py-1.5 mt-1">
      <TouchableOpacity
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
        className="mr-2"
      >
        <Text className="text-lg">{playing ? '⏸️' : '▶️'}</Text>
      </TouchableOpacity>
      <Text className="text-xs text-gray-500 flex-1">
        {formatDuration(position)} / {formatDuration(duration)}
      </Text>
      <TouchableOpacity
        onPress={cycleSpeed}
        accessibilityRole="button"
        accessibilityLabel={`Velocidade ${speed}x`}
        className="ml-2"
      >
        <Text className="text-xs font-medium text-indigo-600">{speed}x</Text>
      </TouchableOpacity>
    </View>
  );
}
