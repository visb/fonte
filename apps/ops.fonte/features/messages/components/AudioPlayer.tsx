import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

interface Props {
  url: string;
  isOwn: boolean;
}

const ACCENT_OWN = '#a5b4fc';
const ACCENT_OTHER = '#4f46e5';
const TRACK_OWN = 'rgba(255,255,255,0.25)';
const TRACK_OTHER = '#e5e7eb';

export function AudioPlayer({ url, isOwn }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => null);
    };
  }, []);

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis);
    if (status.durationMillis) setDuration(status.durationMillis);
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
      soundRef.current?.setPositionAsync(0);
    }
  }

  async function togglePlay() {
    if (!soundRef.current) {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true }, onStatus);
      soundRef.current = sound;
    } else if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  }

  async function handleSeek(e: { nativeEvent: { locationX: number } }) {
    if (!soundRef.current || duration === 0 || trackWidth === 0) return;
    const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth));
    await soundRef.current.setPositionAsync(ratio * duration);
  }

  function onTrackLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  const progress = duration > 0 ? position / duration : 0;
  const accent = isOwn ? ACCENT_OWN : ACCENT_OTHER;
  const trackBg = isOwn ? TRACK_OWN : TRACK_OTHER;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, minWidth: 200 }}>
      <TouchableOpacity onPress={togglePlay} hitSlop={8}>
        <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={32} color={accent} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View
          onLayout={onTrackLayout}
          onTouchEnd={handleSeek}
          style={{ height: 4, borderRadius: 2, backgroundColor: trackBg, overflow: 'hidden' }}
        >
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: accent, borderRadius: 2 }} />
        </View>
      </View>
      <Text style={{ fontSize: 11, color: accent, minWidth: 36, textAlign: 'right' }}>
        {duration > 0 ? formatMs(position > 0 ? position : duration) : '–:––'}
      </Text>
    </View>
  );
}
