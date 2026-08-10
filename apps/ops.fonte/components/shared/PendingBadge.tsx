import { View, Text } from 'react-native';

/**
 * Selo de "ainda não chegou ao servidor" (story 171, decisão 5).
 *
 * O app mostra o lançamento na hora (update otimista da story 169); este selo é
 * o que impede a leitura errada de que ele já subiu. Termo único em todas as
 * telas — o mesmo da tela de pendências (`SYNC_STATUS_LABELS.pending`).
 */
interface Props {
  /** Texto curto; o default é o termo usado em todo o app. */
  label?: string;
}

export function PendingBadge({ label = 'Pendente' }: Props) {
  return (
    <View testID="pending-sync-badge" className="bg-amber-50 rounded-full px-2 py-0.5 self-start">
      <Text className="text-xs text-amber-700 font-medium">{label}</Text>
    </View>
  );
}
