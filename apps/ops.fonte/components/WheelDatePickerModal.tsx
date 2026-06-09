import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ITEM_H = 44;

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function PickerColumn({
  items,
  selectedIndex,
  onChange,
}: {
  items: string[];
  selectedIndex: number;
  onChange: (i: number) => void;
}) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }, 50);
  }, []);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onChange(Math.max(0, Math.min(idx, items.length - 1)));
  }

  return (
    <ScrollView
      ref={ref}
      style={{ height: ITEM_H * 5, flex: 1 }}
      contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onMomentumScrollEnd={onScrollEnd}
      onScrollEndDrag={onScrollEnd}
    >
      {items.map((label, i) => (
        <View key={i} style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#111827' }}>{label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

export function WheelDatePickerModal({
  visible,
  date,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  date: Date;
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - 5 + i));

  const [day, setDay] = useState(date.getDate() - 1);
  const [month, setMonth] = useState(date.getMonth());
  const [year, setYear] = useState(years.indexOf(String(date.getFullYear())));

  const yearNum = parseInt(years[year] ?? String(currentYear));
  const dayCount = daysInMonth(month, yearNum);
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, '0'));
  const safeDay = Math.min(day, dayCount - 1);

  function confirm() {
    onConfirm(new Date(yearNum, month, safeDay + 1));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity activeOpacity={1}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              Selecionar data
            </Text>
            <View style={{ position: 'relative' }}>
              <View
                style={{
                  position: 'absolute', top: ITEM_H * 2, left: 0, right: 0,
                  height: ITEM_H, backgroundColor: '#f3f4f6', borderRadius: 8,
                }}
                pointerEvents="none"
              />
              <View style={{ flexDirection: 'row' }}>
                <PickerColumn items={days} selectedIndex={safeDay} onChange={setDay} />
                <PickerColumn items={MONTHS_PT} selectedIndex={month} onChange={setMonth} />
                <PickerColumn items={years} selectedIndex={year} onChange={setYear} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' }}
                onPress={onCancel}
              >
                <Text style={{ color: '#374151', fontWeight: '500' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' }}
                onPress={confirm}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
