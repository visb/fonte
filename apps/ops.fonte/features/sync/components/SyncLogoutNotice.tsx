import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Aviso que a story 169 deixou em aberto: o fim de sessão apaga o cache
 * persistido e a fila junto (decisão LGPD do epic 167 — `clearSessionData`).
 *
 * Quem sai do app com lançamento na fila **perde o lançamento**, e isso precisa
 * estar escrito onde a fila é vista. Nada some em silêncio, nem por logout.
 */
export function SyncLogoutNotice() {
  return (
    <View
      testID="sync-logout-notice"
      className="bg-amber-50 rounded-xl px-4 py-3 flex-row items-start gap-2 mt-4"
    >
      <Ionicons name="alert-circle-outline" size={18} color="#b45309" />
      <Text className="flex-1 text-xs text-amber-800">
        Sair do app apaga os lançamentos que ainda não foram enviados. Espere a fila esvaziar
        antes de sair.
      </Text>
    </View>
  );
}
