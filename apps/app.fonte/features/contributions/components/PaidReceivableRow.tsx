import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RelativePaidReceivable } from '@fonte/api-client';
import { formatBRL, formatDate, formatPaymentMethod, formatReferenceMonth } from '../lib/format';

interface Props {
  receivable: RelativePaidReceivable;
  onDownloadReceipt: (receivableId: string) => void;
  isDownloading?: boolean;
}

/**
 * Story 193 — uma contribuição paga na lista do familiar, com o botão de
 * recibo. Componente próprio (e não item inline no `FlatList`) pela regra do
 * CLAUDE.md: item de lista com conteúdo composto vira componente com nome.
 */
export function PaidReceivableRow({ receivable, onDownloadReceipt, isDownloading = false }: Props) {
  const method = formatPaymentMethod(receivable.paymentMethod);

  return (
    <View className="flex-row items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
      <View className="w-9 h-9 rounded-full bg-violet-100 items-center justify-center shrink-0">
        <Ionicons name="cash-outline" size={18} color="#7c3aed" />
      </View>

      <View className="flex-1 min-w-0">
        <Text className="text-sm font-medium text-gray-900">
          {formatReferenceMonth(receivable.referenceMonth)}
        </Text>
        <Text className="text-xs text-gray-500 mt-0.5">
          Pago em {formatDate(receivable.paidAt)}
          {method ? ` · ${method}` : ''}
        </Text>
      </View>

      <Text className="text-sm font-semibold text-gray-900 shrink-0">
        {formatBRL(receivable.paidAmount)}
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Baixar recibo de ${formatReferenceMonth(receivable.referenceMonth)}`}
        disabled={isDownloading}
        onPress={() => onDownloadReceipt(receivable.id)}
        className="w-9 h-9 rounded-full bg-violet-600 items-center justify-center shrink-0"
      >
        {isDownloading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="download-outline" size={18} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}
