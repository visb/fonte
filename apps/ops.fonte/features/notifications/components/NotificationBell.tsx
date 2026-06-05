import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnreadCount, useNotificationSocket } from '../hooks/useNotifications';
import { NotificationsSheet } from './NotificationsSheet';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  // Mount the realtime channel once (the header is present on the home screen).
  useNotificationSocket();
  const { data: unread = 0 } = useUnreadCount();

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        accessibilityLabel="Notificações"
        testID="notification-bell"
        className="relative p-1"
      >
        <Ionicons name="notifications-outline" size={24} color="#fff" />
        {unread > 0 && (
          <View
            testID="notification-badge"
            className="absolute -right-0.5 -top-0.5 min-w-[16px] h-4 rounded-full bg-red-500 items-center justify-center px-1"
          >
            <Text className="text-[10px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <NotificationsSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
