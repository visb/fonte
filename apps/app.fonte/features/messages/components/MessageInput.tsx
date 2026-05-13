import { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <View className="flex-row items-end gap-2 px-3 py-2 bg-white border-t border-gray-100">
      <TextInput
        className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-900 max-h-32"
        placeholder="Escreva uma mensagem..."
        value={text}
        onChangeText={setText}
        multiline
        editable={!disabled}
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!text.trim() || disabled}
        className={`w-10 h-10 rounded-full items-center justify-center ${
          text.trim() && !disabled ? 'bg-violet-600' : 'bg-gray-200'
        }`}
      >
        <Ionicons
          name="send"
          size={18}
          color={text.trim() && !disabled ? '#fff' : '#9ca3af'}
        />
      </TouchableOpacity>
    </View>
  );
}
