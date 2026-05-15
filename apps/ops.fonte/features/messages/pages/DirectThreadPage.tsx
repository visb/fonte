import { useRef } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
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

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
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
        {message.attachmentType === 'image' && message.attachmentUrl ? (
          <Image
            source={{ uri: resolveAssetUrl(message.attachmentUrl) ?? message.attachmentUrl }}
            style={{ width: 200, height: 200 }}
            resizeMode="cover"
          />
        ) : message.attachmentType === 'audio' && message.attachmentUrl ? (
          <AudioPlayer url={resolveAssetUrl(message.attachmentUrl) ?? message.attachmentUrl} isOwn={isOwn} />
        ) : message.attachmentType === 'document' ? (
          <View className="flex-row items-center gap-2 px-3 py-2">
            <Ionicons name="document-text-outline" size={18} color={isOwn ? '#a5b4fc' : '#4f46e5'} />
            <Text className={`text-sm ${isOwn ? 'text-indigo-200' : 'text-indigo-700'}`}>Documento</Text>
          </View>
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
