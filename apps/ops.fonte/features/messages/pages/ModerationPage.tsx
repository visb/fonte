import { useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApproveMessage, usePendingMessages, useRejectMessage } from '../hooks/useMessages';
import { AudioPlayer } from '../components/AudioPlayer';
import { resolveAssetUrl } from '@/lib/api';
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
        <Image
          source={{ uri: url }}
          style={{ width: '100%', height: 200, borderRadius: 8 }}
          resizeMode="cover"
        />
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
          <Image
            source={{ uri: url }}
            style={{ flex: 1 }}
            resizeMode="contain"
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function AttachmentContent({ message }: { message: Message }) {
  if (!message.attachmentUrl || !message.attachmentType) return null;

  const resolvedUrl = resolveAssetUrl(message.attachmentUrl) ?? message.attachmentUrl;

  if (message.attachmentType === 'image') {
    return <ImageAttachment url={resolvedUrl} />;
  }

  if (message.attachmentType === 'audio') {
    return (
      <View className="bg-gray-50 rounded-lg overflow-hidden">
        <AudioPlayer url={resolvedUrl} isOwn={false} />
      </View>
    );
  }

  if (message.attachmentType === 'document') {
    const filename = getFilenameFromUrl(message.attachmentUrl);
    const ext = getExtension(filename);
    return (
      <TouchableOpacity
        onPress={() => Linking.openURL(resolvedUrl)}
        className="flex-row items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2"
      >
        <View className="bg-indigo-100 rounded px-1.5 py-0.5">
          <Text className="text-xs font-bold text-indigo-700">{ext}</Text>
        </View>
        <Text className="flex-1 text-sm text-indigo-800" numberOfLines={1}>
          {filename}
        </Text>
        <Ionicons name="download-outline" size={16} color="#4f46e5" />
      </TouchableOpacity>
    );
  }

  return null;
}

function PendingMessageCard({ message }: { message: Message }) {
  const approveMutation = useApproveMessage();
  const rejectMutation = useRejectMessage();
  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <View className="bg-white border border-gray-100 rounded-xl mx-4 my-2 p-4 gap-3">
      <View className="flex-row items-center gap-1 flex-wrap">
        <Text className="text-xs font-medium text-gray-700">{message.senderName}</Text>
        <Ionicons name="arrow-forward" size={10} color="#9ca3af" />
        <Text className="text-xs font-medium text-gray-700">{message.recipientName}</Text>
      </View>

      <AttachmentContent message={message} />

      {message.content ? (
        <Text className="text-sm text-gray-900">{message.content}</Text>
      ) : null}

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => approveMutation.mutate(message.id)}
          disabled={isPending}
          className="flex-1 bg-green-50 border border-green-200 rounded-lg py-2 items-center flex-row justify-center gap-1"
        >
          <Ionicons name="checkmark" size={14} color="#16a34a" />
          <Text className="text-sm text-green-700 font-medium">Aprovar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => rejectMutation.mutate(message.id)}
          disabled={isPending}
          className="flex-1 bg-red-50 border border-red-200 rounded-lg py-2 items-center flex-row justify-center gap-1"
        >
          <Ionicons name="close" size={14} color="#dc2626" />
          <Text className="text-sm text-red-700 font-medium">Rejeitar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ModerationPage() {
  const { data: pending = [], refetch, isRefetching } = usePendingMessages();

  return (
    <FlatList
      data={pending}
      keyExtractor={(m) => m.id}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      renderItem={({ item }) => <PendingMessageCard message={item} />}
      ListEmptyComponent={
        <View className="flex-1 items-center justify-center py-20">
          <Ionicons name="checkmark-circle-outline" size={40} color="#d1d5db" />
          <Text className="text-base font-medium text-gray-400 mt-4">
            Nenhuma mensagem pendente
          </Text>
        </View>
      }
    />
  );
}
