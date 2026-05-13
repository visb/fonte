import { View, Text } from 'react-native';
import { MessageStatus } from '@fonte/types';
import type { Message } from '@fonte/api-client';

interface Props {
  message: Message;
  myUserId: string;
}

export function MessageBubble({ message, myUserId }: Props) {
  const isMine = message.senderUserId === myUserId;
  const isPending = message.status === MessageStatus.PENDING_APPROVAL;

  const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View className={`max-w-[80%] mb-2 ${isMine ? 'self-end' : 'self-start'}`}>
      {!isMine && (
        <Text className="text-xs text-gray-500 mb-0.5 ml-1">{message.senderName}</Text>
      )}
      <View
        className={`rounded-2xl px-4 py-2.5 ${
          isMine ? 'bg-violet-600 rounded-br-sm' : 'bg-white border border-gray-200 rounded-bl-sm'
        }`}
      >
        <Text className={isMine ? 'text-white text-sm' : 'text-gray-900 text-sm'}>
          {message.content}
        </Text>
        <View className="flex-row items-center justify-end gap-1 mt-1">
          <Text className={`text-xs ${isMine ? 'text-violet-200' : 'text-gray-400'}`}>
            {time}
          </Text>
          {isMine && isPending && (
            <Text className="text-xs text-violet-200">· aguardando aprovação</Text>
          )}
        </View>
      </View>
    </View>
  );
}
