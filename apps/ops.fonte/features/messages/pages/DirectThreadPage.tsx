import { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { resolveAssetUrl } from '@/lib/api';
import { useDirectThread, useSendDirectMessage } from '../hooks/useMessages';
import { MessageInput } from '../components/MessageInput';
import { AudioPlayer } from '../components/AudioPlayer';
import type { Message } from '@fonte/api-client';

function getFilenameFromUrl(url: string): string {
  return decodeURIComponent(url.split('/').pop() ?? 'documento');
}

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '?';
}

function ImageAttachment({ url }: { url: string }) {
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.9}>
        <Image source={{ uri: url }} style={{ width: 200, height: 200 }} resizeMode="cover" />
      </TouchableOpacity>
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <TouchableOpacity
            onPress={() => setModalVisible(false)}
            style={{ padding: 16, alignSelf: 'flex-end' }}
            hitSlop={8}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri: url }} style={{ flex: 1 }} resizeMode="contain" />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const resolvedUrl = message.attachmentUrl
    ? (resolveAssetUrl(message.attachmentUrl) ?? message.attachmentUrl)
    : null;

  return (
    <View className={`mb-2 max-w-[75%] ${isOwn ? 'self-end' : 'self-start'}`}>
      {!isOwn && (
        <Text className="text-xs text-gray-400 mb-0.5 ml-1">{message.senderName}</Text>
      )}
      <View
        className={`rounded-2xl overflow-hidden ${
          isOwn ? 'bg-[#272950]' : 'bg-white border border-gray-100'
        }`}
      >
        {message.attachmentType === 'image' && resolvedUrl ? (
          <ImageAttachment url={resolvedUrl} />
        ) : message.attachmentType === 'audio' && resolvedUrl ? (
          <AudioPlayer url={resolvedUrl} isOwn={isOwn} />
        ) : message.attachmentType === 'document' && resolvedUrl ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(resolvedUrl)}
            className="flex-row items-center gap-2 px-3 py-2.5"
          >
            <Ionicons name="document-text-outline" size={18} color={isOwn ? '#a5b4fc' : '#4f46e5'} />
            <View className="flex-1">
              <Text
                className={`text-sm font-medium ${isOwn ? 'text-indigo-200' : 'text-indigo-700'}`}
                numberOfLines={1}
              >
                {message.attachmentUrl ? getFilenameFromUrl(message.attachmentUrl) : 'Documento'}
              </Text>
              <Text className={`text-xs ${isOwn ? 'text-indigo-400' : 'text-indigo-400'}`}>
                {message.attachmentUrl ? getExtension(getFilenameFromUrl(message.attachmentUrl)) : ''} · toque para baixar
              </Text>
            </View>
            <Ionicons name="download-outline" size={15} color={isOwn ? '#a5b4fc' : '#4f46e5'} />
          </TouchableOpacity>
        ) : null}
        {message.content ? (
          <Text className={`text-sm px-3 py-2 ${isOwn ? 'text-white' : 'text-gray-900'}`}>
            {message.content}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function DirectThreadPage() {
  const { relativeId } = useLocalSearchParams<{ relativeId: string }>();
  const { staff } = useAuth();
  const listRef = useRef<FlatList>(null);

  const staffId = staff?.id ?? '';
  const { data: messages = [] } = useDirectThread(staffId, relativeId);
  const sendMutation = useSendDirectMessage();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        className="flex-1 px-4 pt-4"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <MessageBubble message={item} isOwn={item.senderUserId === staff?.userId} />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <Text className="text-sm text-gray-400">Nenhuma mensagem ainda</Text>
          </View>
        }
      />
      <MessageInput
        onSend={(payload) => sendMutation.mutate({ staffId, relativeId, payload })}
        disabled={sendMutation.isPending}
      />
    </KeyboardAvoidingView>
  );
}
