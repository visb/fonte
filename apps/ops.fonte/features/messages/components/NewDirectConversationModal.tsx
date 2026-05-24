import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { resolveAssetUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useHouseRelativesForMessages } from '../hooks/useMessages';
import type { Relative } from '@fonte/api-client';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface RelativeEntry {
  residentId: string;
  residentName: string;
  relatives: Relative[];
}

function RelativeAvatar({ photoUrl }: { photoUrl: string | null }) {
  const uri = resolveAssetUrl(photoUrl);
  if (uri) {
    return <Image source={{ uri }} style={{ width: 36, height: 36, borderRadius: 18 }} />;
  }
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(39,41,80,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="person-outline" size={18} color="#272950" />
    </View>
  );
}

export function NewDirectConversationModal({ visible, onClose }: Props) {
  const { staff } = useAuth();
  const houseId = staff?.houseId ?? null;
  const { data: groups = [], isLoading } = useHouseRelativesForMessages(houseId);

  function handleSelect(relative: Relative, residentName: string) {
    onClose();
    router.push({
      pathname: '/(app)/messages/direct/[relativeId]' as never,
      params: {
        relativeId: relative.id,
        partnerName: relative.name,
        partnerPhotoUrl: '',
      },
    } as never);
  }

  function renderGroup({ item }: { item: RelativeEntry }) {
    return (
      <View>
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f3f4f6' }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {item.residentName}
          </Text>
        </View>
        {item.relatives.map((rel) => (
          <Pressable
            key={rel.id}
            onPress={() => handleSelect(rel, item.residentName)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: '#fff',
              borderBottomWidth: 1,
              borderBottomColor: '#f3f4f6',
            }}
          >
            <RelativeAvatar photoUrl={null} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}>{rel.name}</Text>
              {rel.relationship ? (
                <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{rel.relationship}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: '#fff',
            borderBottomWidth: 1,
            borderBottomColor: '#f3f4f6',
          }}
        >
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="#272950" />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 16,
              fontWeight: '600',
              color: '#111827',
            }}
          >
            Nova conversa
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#272950" />
          </View>
        ) : !houseId ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Ionicons name="home-outline" size={40} color="#d1d5db" />
            <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 12, textAlign: 'center' }}>
              Seu perfil não está vinculado a uma casa
            </Text>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.residentId}
            renderItem={renderGroup}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
                <Ionicons name="people-outline" size={40} color="#d1d5db" />
                <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 12 }}>
                  Nenhum familiar cadastrado na casa
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
