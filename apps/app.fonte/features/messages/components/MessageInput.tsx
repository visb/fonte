import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { AttachmentMenu } from './AttachmentMenu';
import { RecordingBar } from './RecordingBar';

export interface MessageAttachment {
  uri: string;
  mimeType: string;
  name: string;
  type: 'image' | 'audio' | 'document';
}

export interface SendPayload {
  content?: string;
  attachments?: MessageAttachment[];
}

interface Props {
  onSend: (payload: SendPayload) => void;
  disabled?: boolean;
  accentColor?: string;
}

export function MessageInput({ onSend, disabled, accentColor = '#7c3aed' }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => null);
    };
  }, []);

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      cancelRef.current = false;
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      // permission denied or device error
    }
  }

  async function stopRecording(cancel = false) {
    if (!recordingRef.current) return;
    timerRef.current && clearInterval(timerRef.current);
    cancelRef.current = cancel;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setRecordSeconds(0);
      if (!cancel && uri && !cancelRef.current) {
        onSend({ attachments: [{ uri, mimeType: 'audio/m4a', name: 'audio.m4a', type: 'audio' }] });
      }
    } catch {
      setIsRecording(false);
    }
  }

  async function openCamera() {
    setShowMenu(false);
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setAttachments((prev) => [
        ...prev,
        { uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg', type: 'image' },
      ]);
    }
  }

  async function openGallery() {
    setShowMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      const picked: MessageAttachment[] = result.assets.map((a) => ({
        uri: a.uri,
        mimeType: a.mimeType ?? 'image/jpeg',
        name: a.fileName ?? 'photo.jpg',
        type: 'image',
      }));
      setAttachments((prev) => [...prev, ...picked]);
    }
  }

  async function openDocuments() {
    setShowMenu(false);
    const result = await DocumentPicker.getDocumentAsync({ multiple: false });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setAttachments((prev) => [
        ...prev,
        { uri: a.uri, mimeType: a.mimeType ?? 'application/octet-stream', name: a.name, type: 'document' },
      ]);
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSend() {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    onSend({ content: trimmed || undefined, attachments: attachments.length ? attachments : undefined });
    setText('');
    setAttachments([]);
  }

  const canSend = !!(text.trim() || attachments.length > 0) && !disabled;
  const showSend = canSend || text.length > 0;

  return (
    <View className="bg-white border-t border-gray-100">
      <AttachmentPreview attachments={attachments} accentColor={accentColor} onRemove={removeAttachment} />

      <View className="flex-row items-end gap-2 px-3 py-2">
        {!isRecording && (
          <TouchableOpacity onPress={() => setShowMenu(true)} disabled={disabled} className="pb-1">
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={22} color={disabled ? '#d1d5db' : '#6b7280'} />
            </View>
          </TouchableOpacity>
        )}

        {__DEV__ && !isRecording && !text && (
          <TouchableOpacity
            accessibilityLabel="fill-test-message"
            onPress={() => setText('Mensagem de teste')}
            style={{ width: 44, height: 44, opacity: 0.01 }}
          />
        )}

        {isRecording ? (
          <RecordingBar seconds={recordSeconds} onCancel={() => stopRecording(true)} />
        ) : (
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-900 max-h-32"
            placeholder="Escreva uma mensagem..."
            value={text}
            onChangeText={setText}
            multiline
            editable={!disabled}
          />
        )}

        {showSend && !isRecording ? (
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            accessibilityLabel="Enviar"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: canSend ? accentColor : '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="send" size={18} color={canSend ? '#fff' : '#9ca3af'} />
          </TouchableOpacity>
        ) : (
          <Pressable
            onPressIn={startRecording}
            onPressOut={() => stopRecording(false)}
            disabled={disabled}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isRecording ? '#ef4444' : '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="mic" size={20} color={isRecording ? '#fff' : '#6b7280'} />
          </Pressable>
        )}
      </View>

      <AttachmentMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onCamera={openCamera}
        onGallery={openGallery}
        onDocuments={openDocuments}
        accentColor={accentColor}
      />
    </View>
  );
}

function AttachmentPreview({
  attachments,
  accentColor,
  onRemove,
}: {
  attachments: MessageAttachment[];
  accentColor: string;
  onRemove: (index: number) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 pt-2" contentContainerStyle={{ gap: 8 }}>
      {attachments.map((att, i) => (
        <View key={i} style={{ position: 'relative' }}>
          {att.type === 'image' ? (
            <Image source={{ uri: att.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={att.type === 'audio' ? 'musical-notes' : 'document-text-outline'} size={24} color={accentColor} />
            </View>
          )}
          <TouchableOpacity
            onPress={() => onRemove(i)}
            style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={12} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}
