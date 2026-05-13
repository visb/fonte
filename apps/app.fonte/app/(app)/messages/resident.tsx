import { Stack } from 'expo-router';
import { MessagesPage } from '@/features/messages/pages/MessagesPage';
import { useAuth } from '@/lib/auth';

export default function ResidentThreadScreen() {
  const { relative } = useAuth();
  return (
    <>
      <Stack.Screen
        options={{ title: relative ? `Chat com ${relative.residentName}` : 'Chat' }}
      />
      <MessagesPage />
    </>
  );
}
