import { Image, ScrollView, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MessageAttachment } from './MessageInput';

const ACCENT = '#272950';

interface Props {
  attachments: MessageAttachment[];
  onRemove: (index: number) => void;
}

export function AttachmentPreviews({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ paddingHorizontal: 16, paddingTop: 8 }}
      contentContainerStyle={{ gap: 8 }}
    >
      {attachments.map((att, i) => (
        <View key={i} style={{ position: 'relative' }}>
          {att.type === 'image' ? (
            <Image source={{ uri: att.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons
                name={att.type === 'audio' ? 'musical-notes' : 'document-text-outline'}
                size={24}
                color={ACCENT}
              />
            </View>
          )}
          <TouchableOpacity
            onPress={() => onRemove(i)}
            style={{
              position: 'absolute', top: -6, right: -6,
              backgroundColor: '#ef4444', borderRadius: 10,
              width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={12} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}
