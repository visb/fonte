import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { DailySessionStatus, type DailySessionView } from '@fonte/types';
import { DAILY_LABELS, appliedLabel, changesLabel } from '../constants';

interface Props {
  session: DailySessionView;
  /** Mudanças reais que o "Aplicar" vai gravar (`countChanges`). */
  changes: number;
  isOnline: boolean;
  isApplying: boolean;
  isStarting: boolean;
  /** Pulados do último apply feito neste aparelho. */
  skipped: { key: string; name: string; reason: string }[];
  onApply: () => void;
  onStartNew: () => void;
}

/**
 * Rodapé do board (decisão 8): "Aplicar" com confirmação; depois de aplicada,
 * "Aplicado às HH:mm por Fulano" + "Nova daily" e os pulados, se houver.
 */
export function DailyApplyBar({
  session, changes, isOnline, isApplying, isStarting, skipped, onApply, onStartNew,
}: Props) {
  const applied = session.status !== DailySessionStatus.OPEN;

  const confirm = () =>
    Alert.alert(DAILY_LABELS.applyConfirmTitle, changesLabel(changes), [
      { text: 'Cancelar', style: 'cancel' },
      { text: DAILY_LABELS.apply, onPress: onApply },
    ]);

  const busy = applied ? isStarting : isApplying;
  const disabled = !isOnline || busy;

  return (
    <View className="bg-white border-t border-gray-200 px-4 py-3 gap-2">
      {applied ? (
        <Text testID="daily-applied-label" className="text-sm text-green-700 font-medium">
          {appliedLabel(session.appliedAt, session.appliedByName)}
        </Text>
      ) : null}
      {skipped.length > 0 ? (
        <View testID="daily-skipped" className="bg-amber-50 rounded-lg px-3 py-2 gap-1">
          <Text className="text-xs font-semibold text-amber-800">{DAILY_LABELS.skippedTitle}</Text>
          {skipped.map((s) => (
            <Text key={s.key} className="text-xs text-amber-800">
              {s.name} — {s.reason}
            </Text>
          ))}
        </View>
      ) : null}
      <TouchableOpacity
        testID={applied ? 'daily-start-new' : 'daily-apply'}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={applied ? onStartNew : confirm}
        className={`rounded-lg py-3 items-center ${disabled ? 'bg-gray-300' : 'bg-blue-600'}`}
      >
        <Text className="text-white font-semibold">
          {applied ? DAILY_LABELS.newDaily : `${DAILY_LABELS.apply} (${changesLabel(changes)})`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
