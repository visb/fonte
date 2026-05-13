import { Stack, useLocalSearchParams } from 'expo-router';
import { StaffThreadPage } from '@/features/messages/pages/StaffThreadPage';

export default function StaffThreadScreen() {
  const { staffId, name } = useLocalSearchParams<{ staffId: string; name?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: name ?? 'Chat' }} />
      <StaffThreadPage staffId={staffId} />
    </>
  );
}
