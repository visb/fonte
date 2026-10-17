import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DatePickerModal } from '@/components/DatePickerModal';
import { BR_DATE_LENGTH, formatIsoToBr, maskBrDate, parseBrDate } from '@/lib/date';

export interface DateInputProps {
  /** Data ISO `aaaa-mm-dd`, ou `''` quando vazio. */
  value: string;
  /**
   * Recebe a ISO quando o texto forma uma data real; `''` quando o texto está
   * vazio, incompleto ou inválido. Quem julga (e escreve a mensagem) é o schema.
   */
  onChange: (iso: string) => void;
  /**
   * Opcional: avisa quando há texto digitado que não forma data (incompleto ou
   * inválido). Serve para campo opcional, em que `''` sozinho não distingue
   * "não informado" de "digitado errado".
   */
  onInvalidChange?: (invalid: boolean) => void;
  onBlur?: () => void;
  /** Última data selecionável no calendário (ISO). Digitação é julgada pelo schema. */
  maxDate?: string;
  /** Primeira data selecionável no calendário (ISO). */
  minDate?: string;
  placeholder?: string;
  error?: string;
  /** Nome do campo para leitor de tela e e2e (`getByLabel`). */
  accessibilityLabel: string;
}

/**
 * Campo de data digitável (story 209): máscara `dd/mm/aaaa` + ícone que abre o
 * calendário (`DatePickerModal`) como alternativa. O valor do form é sempre a
 * ISO — o mesmo contrato do picker, então payloads e fila offline não mudam.
 */
export function DateInput({
  value,
  onChange,
  onInvalidChange,
  onBlur,
  maxDate,
  minDate,
  placeholder = 'dd/mm/aaaa',
  error,
  accessibilityLabel,
}: DateInputProps) {
  const [text, setText] = useState(() => formatIsoToBr(value));
  const [pickerOpen, setPickerOpen] = useState(false);
  // Último valor que este campo emitiu: se o `value` mudar por fora (picker,
  // reset do form), o texto acompanha; se for eco da digitação, não mexe.
  const emitted = useRef(value);

  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setText(formatIsoToBr(value));
    onInvalidChange?.(false);
  }, [value, onInvalidChange]);

  function emit(iso: string, nextText: string) {
    emitted.current = iso;
    onChange(iso);
    onInvalidChange?.(nextText !== '' && iso === '');
  }

  function handleChangeText(raw: string) {
    const masked = maskBrDate(raw);
    setText(masked);
    emit(parseBrDate(masked) ?? '', masked);
  }

  function handlePick(iso: string) {
    const formatted = formatIsoToBr(iso);
    setText(formatted);
    emit(iso, formatted);
  }

  return (
    <View>
      <View
        className={`border rounded-lg flex-row items-center ${error ? 'border-red-400' : 'border-gray-300'}`}
      >
        <TextInput
          className="flex-1 px-3 py-2.5 text-sm text-gray-900"
          value={text}
          onChangeText={handleChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
          maxLength={BR_DATE_LENGTH}
          accessibilityLabel={accessibilityLabel}
        />
        <TouchableOpacity
          className="px-3 py-2.5"
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir calendário: ${accessibilityLabel}`}
          hitSlop={8}
        >
          <Ionicons name="calendar-outline" size={18} color="#6b7280" />
        </TouchableOpacity>
      </View>
      {error ? <Text className="text-xs text-red-600 mt-1">{error}</Text> : null}
      <DatePickerModal
        visible={pickerOpen}
        value={value}
        maximumDate={maxDate}
        minimumDate={minDate}
        onClose={() => setPickerOpen(false)}
        onChange={handlePick}
      />
    </View>
  );
}
