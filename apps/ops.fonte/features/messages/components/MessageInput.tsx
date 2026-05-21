import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { AttachmentPreviews } from './AttachmentPreviews';
import { AttachmentMenuSheet } from './AttachmentMenuSheet';

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
}

const ACCENT = '#272950';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function MessageInput({ onSend, disabled }: Props) {
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
    <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
      <AttachmentPreviews attachments={attachments} onRemove={removeAttachment} />

      {/* Input row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        {!isRecording && (
          <TouchableOpacity onPress={() => setShowMenu(true)} disabled={disabled}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={22} color={disabled ? '#d1d5db' : '#6b7280'} />
            </View>
          </TouchableOpacity>
        )}

        {isRecording ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
            <Text style={{ flex: 1, color: '#dc2626', fontSize: 14 }}>Gravando... {formatDuration(recordSeconds)}</Text>
            <TouchableOpacity onPress={() => stopRecording(true)}>
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput
            style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 96 }}
            value={text}
            onChangeText={setText}
            placeholder="Escreva uma mensagem..."
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!disabled}
          />
        )}

        {showSend && !isRecording ? (
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: canSend ? ACCENT : '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="send" size={16} color={canSend ? '#fff' : '#9ca3af'} />
          </TouchableOpacity>
        ) : (
          <Pressable
            onPressIn={startRecording}
            onPressOut={() => stopRecording(false)}
            disabled={disabled}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isRecording ? '#ef4444' : '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="mic" size={18} color={isRecording ? '#fff' : '#6b7280'} />
          </Pressable>
        )}
      </View>

      <AttachmentMenuSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onCamera={openCamera}
        onGallery={openGallery}
        onDocument={openDocuments}
      />
    </View>
  );
}
