import { useState } from 'react';
import { Image, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveAssetUrl } from '@/lib/api';

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function plural(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function timeAcolhido(entryIso: string | null): string | null {
  if (!entryIso) return null;
  const start = new Date(`${entryIso.split('T')[0]}T00:00:00`);
  const end = new Date();
  if (Number.isNaN(start.getTime()) || end < start) return null;

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  const anchor = new Date(start);
  anchor.setMonth(anchor.getMonth() + months);
  if (anchor > end) {
    months -= 1;
    anchor.setMonth(anchor.getMonth() - 1);
  }

  const dayMs = 86_400_000;
  const totalDays = Math.floor((end.getTime() - anchor.getTime()) / dayMs);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;

  const parts: string[] = [];
  if (months > 0) parts.push(plural(months, 'mês', 'meses'));
  if (weeks > 0) parts.push(plural(weeks, 'semana', 'semanas'));
  if (days > 0) parts.push(plural(days, 'dia', 'dias'));

  if (parts.length === 0) return 'hoje';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

interface Props {
  name: string;
  birthDate: string | null;
  entryDate: string | null;
  photoUrl?: string | null;
  photoThumbUrl?: string | null;
}

export function ResidentDetailHeader({
  name,
  birthDate,
  entryDate,
  photoUrl,
  photoThumbUrl,
}: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const thumbUrl = resolveAssetUrl(photoThumbUrl ?? photoUrl);
  const fullUrl = resolveAssetUrl(photoUrl ?? photoThumbUrl);
  const tempo = timeAcolhido(entryDate);
  const nasc = fmtDate(birthDate);

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: '#272950' }}>
      <View className="flex-row items-center px-2 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-1">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!fullUrl}
          onPress={() => setOpen(true)}
          className="w-12 h-12 rounded-full bg-white/10 items-center justify-center overflow-hidden mr-3"
        >
          {thumbUrl ? (
            <Image source={{ uri: thumbUrl }} className="w-12 h-12 rounded-full" />
          ) : (
            <Ionicons name="person-outline" size={24} color="#fff" />
          )}
        </TouchableOpacity>

        <View className="flex-1 pr-2">
          <Text className="text-white text-base font-semibold" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-white/70 text-xs mt-0.5" numberOfLines={1}>
            {[nasc && `Nasc. ${nasc}`, tempo && `acolhido há ${tempo}`]
              .filter(Boolean)
              .join('  •  ')}
          </Text>
        </View>
      </View>

      {fullUrl && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable
            className="flex-1 bg-black/90 items-center justify-center"
            onPress={() => setOpen(false)}
          >
            <Image source={{ uri: fullUrl }} className="w-full h-2/3" resizeMode="contain" />
            <TouchableOpacity
              onPress={() => setOpen(false)}
              className="absolute top-12 right-6 p-2"
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-base mt-4">{name}</Text>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
