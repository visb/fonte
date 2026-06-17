import { View, Text } from 'react-native';
import { ActivityStatus } from '@fonte/types';

const STATUS_CONFIG: Record<ActivityStatus, { label: string; color: string }> = {
  [ActivityStatus.DRAFT]: { label: 'Rascunho', color: '#6b7280' },
  [ActivityStatus.REQUESTED]: { label: 'Solicitação', color: '#2563eb' },
  [ActivityStatus.TODO]: { label: 'A fazer', color: '#7c3aed' },
  [ActivityStatus.DOING]: { label: 'Fazendo', color: '#b45309' },
  [ActivityStatus.BLOCKED]: { label: 'Impedimento', color: '#dc2626' },
  [ActivityStatus.DONE]: { label: 'Concluída', color: '#16a34a' },
};

export function StatusBadge({ status }: { status: ActivityStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#6b7280' };
  return (
    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${cfg.color}20` }}>
      <Text className="text-xs font-medium" style={{ color: cfg.color }}>
        {cfg.label}
      </Text>
    </View>
  );
}
