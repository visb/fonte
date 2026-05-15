import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageStatus } from '@fonte/types';
import type { Message } from '@fonte/api-client';
import { api } from '@/lib/api';
import { AudioPlayer } from './AudioPlayer';

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

  const bubbleClass = isMine
    ? 'bg-violet-600 rounded-br-sm'
    : 'bg-white border border-gray-200 rounded-bl-sm';

  return (
    <View className={`max-w-[80%] mb-2 ${isMine ? 'self-end' : 'self-start'}`}>
      {!isMine && (
        <Text className="text-xs text-gray-500 mb-0.5 ml-1">{message.senderName}</Text>
      )}
      <View className={`rounded-2xl overflow-hidden ${bubbleClass}`}>
        {message.attachmentType === 'image' && message.attachmentUrl ? (
          <Image
            source={{ uri: api.photoUrl(message.attachmentUrl) ?? message.attachmentUrl }}
            style={{ width: 200, height: 200 }}
            resizeMode="cover"
          />
        ) : message.attachmentType === 'audio' && message.attachmentUrl ? (
          <AudioPlayer url={api.photoUrl(message.attachmentUrl) ?? message.attachmentUrl} isMine={isMine} />
        ) : message.attachmentType === 'document' ? (
          <View className="flex-row items-center gap-2 px-4 py-3">
            <Ionicons name="document-text-outline" size={20} color={isMine ? '#ede9fe' : '#7c3aed'} />
            <Text className={`text-sm ${isMine ? 'text-violet-100' : 'text-violet-700'}`}>Documento</Text>
          </View>
        ) : null}
        {message.content ? (
          <Text
            className={`text-sm px-4 py-2.5 ${isMine ? 'text-white' : 'text-gray-900'}`}
          >
            {message.content}
          </Text>
        ) : null}
        <View className="flex-row items-center justify-end gap-1 px-4 pb-2">
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
