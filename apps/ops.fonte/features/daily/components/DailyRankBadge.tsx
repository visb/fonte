import { Text, View } from 'react-native';
import { DailyPersonType, type DailyPerson } from '@fonte/types';
import { ServantRankBadge } from '@/components/shared/ServantRankBadge';
import { DAILY_ROLE_BADGE } from '../constants';

interface Props {
  person: DailyPerson;
}

/**
 * Badge do servo no board (decisão 6): o nível (`rank`); staff sem nível
 * mostra o papel ("Coordenador") para nunca ficar igual a um filho. Filho: nada.
 */
export function DailyRankBadge({ person }: Props) {
  if (person.type !== DailyPersonType.STAFF) return null;
  if (person.rank) return <ServantRankBadge rank={person.rank} />;
  if (!person.roleLabel) return null;
  return (
    <View
      testID={`daily-role-badge-${person.id}`}
      className="rounded-full px-2 py-0.5 self-start"
      style={{ backgroundColor: DAILY_ROLE_BADGE.bg }}
    >
      <Text className="text-xs font-medium" style={{ color: DAILY_ROLE_BADGE.color }}>
        {person.roleLabel}
      </Text>
    </View>
  );
}
