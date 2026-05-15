import { Image, View, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { resolveAssetUrl } from '@/lib/api';
import { TimeLimitedScreen } from '@/components/TimeLimitedScreen';
import { ConversationPage } from '@/features/messages/pages/ConversationPage';

export default function ConversationScreen() {
  const { partnerName, partnerPhotoUrl } = useLocalSearchParams<{ partnerName?: string; partnerPhotoUrl?: string }>();
  const { isResident } = useAuth();
  const photoUri = resolveAssetUrl(partnerPhotoUrl || null);

  const content = isResident ? (
    <TimeLimitedScreen>
      <ConversationPage />
    </TimeLimitedScreen>
  ) : (
    <ConversationPage />
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={{ width: 32, height: 32, borderRadius: 16 }} />
              ) : (
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={18} color="#fff" />
                </View>
              )}
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>{partnerName ?? 'Conversa'}</Text>
            </View>
          ),
        }}
      />
      {content}
    </>
  );
}
