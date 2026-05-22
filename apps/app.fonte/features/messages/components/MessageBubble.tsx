import { useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageStatus } from '@fonte/types';
import type { Message } from '@fonte/api-client';
import { api } from '@/lib/api';
import { AudioPlayer } from './AudioPlayer';

function getFilenameFromUrl(url: string): string {
  return decodeURIComponent(url.split('/').pop() ?? 'documento');
}

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '?';
}

function ImageAttachment({ url, isMine }: { url: string; isMine: boolean }) {
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

  const resolvedUrl = message.attachmentUrl
    ? (api.photoUrl(message.attachmentUrl) ?? message.attachmentUrl)
    : null;

  return (
    <View className={`max-w-[80%] mb-2 ${isMine ? 'self-end' : 'self-start'}`}>
      {!isMine && (
        <Text className="text-xs text-gray-500 mb-0.5 ml-1">{message.senderName}</Text>
      )}
      <View className={`rounded-2xl overflow-hidden ${bubbleClass}`}>
        {message.attachmentType === 'image' && resolvedUrl ? (
          <ImageAttachment url={resolvedUrl} isMine={isMine} />
        ) : message.attachmentType === 'audio' && resolvedUrl ? (
          <AudioPlayer url={resolvedUrl} isMine={isMine} />
        ) : message.attachmentType === 'document' && resolvedUrl ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(resolvedUrl)}
            className="flex-row items-center gap-2 px-4 py-3"
          >
            <Ionicons name="document-text-outline" size={20} color={isMine ? '#ede9fe' : '#7c3aed'} />
            <View className="flex-1">
              <Text
                className={`text-sm font-medium ${isMine ? 'text-violet-100' : 'text-violet-700'}`}
                numberOfLines={1}
              >
                {message.attachmentUrl ? getFilenameFromUrl(message.attachmentUrl) : 'Documento'}
              </Text>
              <Text className={`text-xs ${isMine ? 'text-violet-300' : 'text-violet-400'}`}>
                {message.attachmentUrl ? getExtension(getFilenameFromUrl(message.attachmentUrl)) : ''} · toque para baixar
              </Text>
            </View>
            <Ionicons name="download-outline" size={16} color={isMine ? '#ede9fe' : '#7c3aed'} />
          </TouchableOpacity>
        ) : null}
        {message.content ? (
          <Text className={`text-sm px-4 py-2.5 ${isMine ? 'text-white' : 'text-gray-900'}`}>
            {message.content}
          </Text>
        ) : null}
        <View className="flex-row items-center justify-end gap-1 px-4 pb-2">
          <Text className={`text-xs ${isMine ? 'text-violet-200' : 'text-gray-400'}`}>
            {time}
          </Text>
          {isMine && isPending && (
            <Text accessibilityLabel="status-aguardando" className="text-xs text-violet-200">· aguardando aprovação</Text>
          )}
        </View>
      </View>
    </View>
  );
}
