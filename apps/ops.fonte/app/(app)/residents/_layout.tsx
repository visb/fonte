import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ResidentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#111827',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Filhos' }} />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Detalhe',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.navigate('/(app)/residents')} style={{ marginRight: 8 }}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
}
