import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { AppMenuItem } from '../constants';

type Props = {
  item: AppMenuItem;
};

export function MenuRow({ item }: Props) {
  return (
    <TouchableOpacity
      testID={`menu-item-${item.key}`}
      accessibilityRole="button"
      // `as never`: os tipos de rota do expo-router são gerados no build (mesmo
      // tratamento das ações rápidas da home).
      onPress={() => router.push(item.route as never)}
      className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100"
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: item.bg }}
      >
        <Ionicons name={item.icon} size={18} color={item.color} />
      </View>
      <Text className="flex-1 text-base text-gray-800">{item.label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </TouchableOpacity>
  );
}
