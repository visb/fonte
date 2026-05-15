import { Image, View, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { StaffThreadPage } from '@/features/messages/pages/StaffThreadPage';

export default function StaffThreadScreen() {
  const { staffId, name, photoUrl } = useLocalSearchParams<{ staffId: string; name?: string; photoUrl?: string }>();
  const photoUri = api.photoUrl(photoUrl || null);

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
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>{name ?? 'Chat'}</Text>
            </View>
          ),
        }}
      />
      <StaffThreadPage staffId={staffId} />
    </>
  );
}
