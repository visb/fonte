import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FollowUpType } from '@fonte/types';
import type { ResidentFollowUp } from '@fonte/api-client';
import { FOLLOW_UP_TYPE_LABELS } from '../constants';

type IoniconString = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_ICONS: Record<FollowUpType, IoniconString> = {
  [FollowUpType.ADMISSION]: 'log-in-outline',
  [FollowUpType.READMISSION]: 'refresh-outline',
  [FollowUpType.DISCHARGE]: 'log-out-outline',
  [FollowUpType.EVASION]: 'warning-outline',
  [FollowUpType.MINISTRY_CHANGE]: 'shuffle-outline',
  [FollowUpType.RELATIVE_ADDED]: 'people-outline',
  [FollowUpType.DOCUMENT_ATTACHED]: 'attach-outline',
  [FollowUpType.MONTHLY_CONTRIBUTION]: 'cash-outline',
  [FollowUpType.DISCIPLINE]: 'shield-outline',
  [FollowUpType.BEHAVIOR_ASSESSMENT]: 'clipboard-outline',
  [FollowUpType.PROMOTED_TO_SERVANT]: 'person-add-outline',
  [FollowUpType.NOTE]: 'document-text-outline',
};

const TYPE_BG: Record<FollowUpType, string> = {
  [FollowUpType.ADMISSION]: 'bg-green-100',
  [FollowUpType.READMISSION]: 'bg-blue-100',
  [FollowUpType.DISCHARGE]: 'bg-purple-100',
  [FollowUpType.EVASION]: 'bg-red-100',
  [FollowUpType.MINISTRY_CHANGE]: 'bg-orange-100',
  [FollowUpType.RELATIVE_ADDED]: 'bg-teal-100',
  [FollowUpType.DOCUMENT_ATTACHED]: 'bg-gray-100',
  [FollowUpType.MONTHLY_CONTRIBUTION]: 'bg-yellow-100',
  [FollowUpType.DISCIPLINE]: 'bg-amber-100',
  [FollowUpType.BEHAVIOR_ASSESSMENT]: 'bg-indigo-100',
  [FollowUpType.PROMOTED_TO_SERVANT]: 'bg-emerald-100',
  [FollowUpType.NOTE]: 'bg-slate-100',
};

const TYPE_COLOR: Record<FollowUpType, string> = {
  [FollowUpType.ADMISSION]: '#15803d',
  [FollowUpType.READMISSION]: '#1d4ed8',
  [FollowUpType.DISCHARGE]: '#7e22ce',
  [FollowUpType.EVASION]: '#dc2626',
  [FollowUpType.MINISTRY_CHANGE]: '#c2410c',
  [FollowUpType.RELATIVE_ADDED]: '#0f766e',
  [FollowUpType.DOCUMENT_ATTACHED]: '#374151',
  [FollowUpType.MONTHLY_CONTRIBUTION]: '#a16207',
  [FollowUpType.DISCIPLINE]: '#b45309',
  [FollowUpType.BEHAVIOR_ASSESSMENT]: '#4338ca',
  [FollowUpType.PROMOTED_TO_SERVANT]: '#047857',
  [FollowUpType.NOTE]: '#475569',
};

interface Props {
  followUp: ResidentFollowUp;
}

export function TrackingEventItem({ followUp }: Props) {
  const icon = TYPE_ICONS[followUp.type];
  const bgClass = TYPE_BG[followUp.type];
  const color = TYPE_COLOR[followUp.type];

  const date = new Date(followUp.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View className="flex-row gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 mb-2">
      <View className={`w-9 h-9 rounded-full items-center justify-center ${bgClass}`}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900">
          {FOLLOW_UP_TYPE_LABELS[followUp.type]}
        </Text>
        {!!followUp.description && (
          <Text className="text-sm text-gray-500 mt-0.5">{followUp.description}</Text>
        )}
        <Text className="text-xs text-gray-400 mt-1">
          {date}{followUp.createdByName ? ` · ${followUp.createdByName}` : ''}
        </Text>
      </View>
    </View>
  );
}
