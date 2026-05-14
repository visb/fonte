import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface Props {
  visible: boolean;
  value: string; // YYYY-MM-DD
  onClose: () => void;
  onChange: (date: string) => void;
}

function parseDate(iso: string): { year: number; month: number } {
  if (!iso) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  const [y, m] = iso.split('-').map(Number);
  return { year: y, month: m - 1 };
}

export function DatePickerModal({ visible, value, onClose, onChange }: Props) {
  const [year, setYear] = useState(() => parseDate(value).year);
  const [month, setMonth] = useState(() => parseDate(value).month);

  useEffect(() => {
    if (visible) {
      const parsed = parseDate(value);
      setYear(parsed.year);
      setMonth(parsed.month);
    }
  }, [visible, value]);

  const today = new Date().toISOString().split('T')[0];
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${year}-${mm}-${dd}`);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}
        onPress={onClose}
      >
        <Pressable style={{ backgroundColor: '#fff', borderRadius: 16, width: 288, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#2563eb' }}>
            <TouchableOpacity onPress={prevMonth} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={8}>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 10 }}>
            {DAY_LABELS.map((l, i) => (
              <Text key={i} style={{ width: '14.28%', textAlign: 'center', fontSize: 11, color: '#9ca3af', fontWeight: '500' }}>
                {l}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 12, paddingTop: 4 }}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={{ width: '14.28%', height: 36 }} />;
              const mm = String(month + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const iso = `${year}-${mm}-${dd}`;
              const isSelected = iso === value;
              const isToday = iso === today;
              return (
                <TouchableOpacity
                  key={day}
                  style={{
                    width: '14.28%', height: 36,
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: 18,
                    backgroundColor: isSelected ? '#2563eb' : 'transparent',
                  }}
                  onPress={() => selectDay(day)}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: isSelected || isToday ? '700' : '400',
                    color: isSelected ? '#fff' : isToday ? '#2563eb' : '#111827',
                  }}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
