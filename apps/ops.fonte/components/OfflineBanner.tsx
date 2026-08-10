import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsOnline } from '@/lib/offline/network';

export const OFFLINE_MESSAGE =
  'Sem conexão — você continua trabalhando; os lançamentos vão ser enviados quando o sinal voltar.';

/**
 * Faixa no topo do app autenticado enquanto não há rede. Some sozinha quando o
 * sinal volta — o operador não precisa fazer nada.
 */
export function OfflineBanner() {
  const isOnline = useIsOnline();

  if (isOnline) return null;

  return (
    <View
      testID="offline-banner"
      accessibilityRole="alert"
      accessibilityLabel="offline-banner"
      style={{
        backgroundColor: '#b45309',
        flexDirection: 'row',
        alignItems: 'center',
        // Sem insets.top: o inset já é pago uma única vez pelo wrapper de
        // app/(app)/_layout.tsx (story 174). Somar aqui = gap duplo offline.
        paddingTop: 8,
        paddingBottom: 8,
        paddingHorizontal: 16,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text
        style={{ flex: 1, color: '#fff', fontSize: 12, fontWeight: '500', marginLeft: 8 }}
      >
        {OFFLINE_MESSAGE}
      </Text>
    </View>
  );
}
