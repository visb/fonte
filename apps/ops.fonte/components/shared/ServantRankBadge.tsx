import { Text, View } from 'react-native';
import type { ServantRank } from '@fonte/types';
import { SERVANT_RANK_BADGE, SERVANT_RANK_LABELS } from '@/features/staff/constants';

interface Props {
  /** Nível do servo; nulo/ausente (coordenador, admin, servo sem nível) → nada. */
  rank: ServantRank | null | undefined;
}

/** Badge colorido do nível do servo (story 207), mesmo padrão do `adm`. */
export function ServantRankBadge({ rank }: Props) {
  if (!rank) return null;
  const badge = SERVANT_RANK_BADGE[rank];
  const label = SERVANT_RANK_LABELS[rank];
  if (!badge || !label) return null;
  return (
    <View
      testID={`servant-rank-${rank}`}
      className="rounded-full px-2 py-0.5 self-start"
      style={{ backgroundColor: badge.bg }}
    >
      <Text className="text-xs font-medium" style={{ color: badge.color }}>
        {label}
      </Text>
    </View>
  );
}
