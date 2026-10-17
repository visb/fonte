import { Image, Linking, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HouseStaffMember } from '@fonte/api-client';
import { resolveAssetUrl } from '@/lib/api';
import { ServantRankBadge } from '@/components/shared/ServantRankBadge';
import { STAFF_ROLE_BADGE, staffRoleLabel, whatsappUrl } from '../constants';

interface Props {
  item: HouseStaffMember;
  /** O usuário logado: aparece com "(você)" e sem botão de WhatsApp. */
  isSelf: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/** Linha da lista *Servos* (story 204): somente leitura + contato. */
export function StaffListItem({ item, isSelf }: Props) {
  const photoUrl = resolveAssetUrl(item.photoUrl);
  const badge = STAFF_ROLE_BADGE[item.role] ?? { color: '#6b7280', bg: '#f3f4f6' };
  const waUrl = isSelf ? null : whatsappUrl(item.whatsapp);
  const ministries = item.ledMinistries.map((m) => m.name).join(', ');

  return (
    <View
      testID={`staff-row-${item.id}`}
      className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex-row items-center"
    >
      <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3 overflow-hidden">
        {photoUrl ? (
          <Image testID="staff-photo" source={{ uri: photoUrl }} className="w-10 h-10 rounded-full" />
        ) : (
          <Text className="text-sm font-semibold text-blue-600">{initials(item.name)}</Text>
        )}
      </View>

      <View className="flex-1 gap-1">
        <View className="flex-row items-center flex-wrap gap-2">
          <Text className="text-sm font-semibold text-gray-900">
            {item.name}
            {isSelf ? <Text className="font-normal text-gray-500"> (você)</Text> : null}
          </Text>
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
            <Text className="text-xs font-medium" style={{ color: badge.color }}>
              {staffRoleLabel(item.role)}
            </Text>
          </View>
          <ServantRankBadge rank={item.rank} />
        </View>
        {ministries ? (
          <Text className="text-xs text-gray-500">Lidera: {ministries}</Text>
        ) : null}
      </View>

      {waUrl ? (
        <TouchableOpacity
          accessibilityLabel={`WhatsApp de ${item.name}`}
          className="pl-3 py-1"
          hitSlop={8}
          onPress={() => void Linking.openURL(waUrl)}
        >
          <Ionicons name="logo-whatsapp" size={24} color="#16a34a" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
