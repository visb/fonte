import { useRef, useEffect } from 'react';
import { View, FlatList } from 'react-native';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { useThread, useSendMessage } from '../hooks/useMessages';

export function MessagesPage() {
  const { relative } = useAuth();
  const listRef = useRef<FlatList>(null);

  const residentId = relative?.residentId ?? '';
  const relativeId = relative?.id ?? '';
  const myUserId = relative?.userId ?? '';

  const { data: messages = [], isLoading, isError, refetch } = useThread(residentId, relativeId);
  const sendMutation = useSendMessage(residentId, relativeId);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <View className="flex-1 bg-gray-50">
      {messages.length === 0 ? (
        <EmptyState message="Nenhuma mensagem ainda. Envie a primeira!" />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <MessageBubble message={item} myUserId={myUserId} />
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}
      <MessageInput
        onSend={(payload) => sendMutation.mutate(payload)}
        disabled={sendMutation.isPending}
      />
    </View>
  );
}
