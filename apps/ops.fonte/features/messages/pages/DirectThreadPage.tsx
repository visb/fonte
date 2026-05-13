import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useDirectThread, useSendDirectMessage } from '../hooks/useMessages';
import type { Message } from '@fonte/api-client';

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <View className={`mb-2 max-w-[75%] ${isOwn ? 'self-end' : 'self-start'}`}>
      {!isOwn && (
        <Text className="text-xs text-gray-400 mb-0.5 ml-1">{message.senderName}</Text>
      )}
      <View
        className={`rounded-2xl px-3 py-2 ${
          isOwn ? 'bg-[#272950]' : 'bg-white border border-gray-100'
        }`}
      >
        <Text className={`text-sm ${isOwn ? 'text-white' : 'text-gray-900'}`}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

export function DirectThreadPage() {
  const { relativeId } = useLocalSearchParams<{ relativeId: string }>();
  const { staff } = useAuth();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  const staffId = staff?.id ?? '';
  const { data: messages = [] } = useDirectThread(staffId, relativeId);
  const sendMutation = useSendDirectMessage();

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    sendMutation.mutate({ staffId, relativeId, content });
  };

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

      <View className="bg-white border-t border-gray-100 px-4 py-3 flex-row items-end gap-2">
        <TextInput
          className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 text-sm max-h-24"
          value={text}
          onChangeText={setText}
          placeholder="Escreva uma mensagem..."
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          className="w-9 h-9 rounded-full bg-[#272950] items-center justify-center"
        >
          <Ionicons name="send" size={16} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
