import { useRef } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useMessageThread, useSendMessage } from '../hooks/useMessages';
import { MessageInput } from '../components/MessageInput';
import { MessageBubble } from '../components/MessageBubble';
import type { Message } from '@fonte/api-client';

export function ConversationPage() {
  const { residentId, relativeId } = useLocalSearchParams<{
    residentId: string;
    relativeId: string;
  }>();
  const { staff, resident } = useAuth();
  const listRef = useRef<FlatList>(null);

  const { data: messages = [] } = useMessageThread(residentId, relativeId);
  const sendMutation = useSendMessage();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m: Message) => m.id}
        className="flex-1 px-4 pt-4"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isOwn =
            item.senderUserId === resident?.userId ||
            (!!staff && item.senderUserId !== resident?.userId);
          return <MessageBubble message={item} isOwn={isOwn} />;
        }}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <Text className="text-sm text-gray-400">Nenhuma mensagem ainda</Text>
          </View>
        }
      />
      <MessageInput
        onSend={(payload) => sendMutation.mutate({ residentId, relativeId, payload })}
        disabled={sendMutation.isPending}
      />
    </KeyboardAvoidingView>
  );
}
