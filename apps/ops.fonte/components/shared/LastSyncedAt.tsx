import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Frescor visível do dado offline (story 175).
 *
 * O store local não apaga ficha velha — o prazo de 24h do cache em blob sumiu de
 * propósito: casa sem sinal por um fim de semana abria vazia. A proteção que o
 * prazo dava vira informação: em vez de esconder o dado velho, a tela diz **quando**
 * ele foi sincronizado e deixa a decisão com o operador.
 */
interface Props {
  /** `syncedAt` do servidor (ISO) guardado no store. Sem sincronização: nada é exibido. */
  syncedAt?: string | null;
}

/** "14/08/2026 às 09:41" — data curta com hora, do jeito que o operador lê. */
export function formatSyncedAt(syncedAt: string): string | null {
  const date = new Date(syncedAt);
  if (Number.isNaN(date.getTime())) return null;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()} às ${hours}:${minutes}`;
}

export function LastSyncedAt({ syncedAt }: Props) {
  const formatted = syncedAt ? formatSyncedAt(syncedAt) : null;
  if (!formatted) return null;

  return (
    <View testID="last-synced-at" className="flex-row items-center gap-1 px-4 py-1">
      <Ionicons name="time-outline" size={12} color="#9ca3af" />
      <Text className="text-[11px] text-gray-400">{`Atualizado em ${formatted}`}</Text>
    </View>
  );
}
