import { Modal, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Notification } from '@fonte/api-client';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '../hooks/useNotifications';
import { NotificationRow } from './NotificationRow';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function NotificationsSheet({ visible, onClose }: Props) {
  const { data: notifications = [], isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handlePress = (item: Notification) => {
    if (!item.read) markRead.mutate(item.id);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-2xl max-h-[80%]">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <Text className="text-base font-bold text-gray-900">Notificações</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar">
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className="px-4 py-2 border-b border-gray-100"
            onPress={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || notifications.length === 0}
          >
            <Text className="text-sm text-blue-600 text-right">Marcar todas como lidas</Text>
          </TouchableOpacity>

          {isLoading ? (
            <View className="py-12">
              <LoadingState />
            </View>
          ) : error ? (
            <View className="py-12">
              <ErrorState message={getErrorMessage(error, 'Erro ao carregar notificações')} />
            </View>
          ) : notifications.length === 0 ? (
            <View className="py-12">
              <EmptyState message="Nenhuma notificação" />
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <NotificationRow
                  item={item}
                  onPress={handlePress}
                  onMarkRead={(id) => markRead.mutate(id)}
                />
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
