import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DatePickerModal } from "@/features/storeroom/components/DatePickerModal";
import { toISODate } from "@/features/supply-room/utils";

function formatDateDisplay(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

type Props = {
  value: Date;
  onChange: (date: Date, iso: string) => void;
};

export function DateField({ value, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">Data</Text>
      <TouchableOpacity
        className="border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 flex-row justify-between items-center"
        onPress={() => setShowPicker(true)}
      >
        <Text className="text-sm text-gray-900">{formatDateDisplay(value)}</Text>
        <Ionicons name="calendar-outline" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <DatePickerModal
        visible={showPicker}
        date={value}
        onConfirm={(d) => {
          onChange(d, toISODate(d));
          setShowPicker(false);
        }}
        onCancel={() => setShowPicker(false)}
      />
    </View>
  );
}
