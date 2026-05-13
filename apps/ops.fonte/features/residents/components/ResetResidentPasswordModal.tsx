import { useState } from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResetResidentPassword } from '../hooks/useResidents';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generatePassword(len = 12) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

interface Props {
  visible: boolean;
  onClose: () => void;
  residentId: string;
  residentName: string;
}

export function ResetResidentPasswordModal({ visible, onClose, residentId, residentName }: Props) {
  const [password] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const mutation = useResetResidentPassword(residentId);

  const handleConfirm = () => {
    mutation.mutate(password, { onSuccess: onClose });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-6">
          <Text className="text-base font-semibold text-gray-900 mb-1">Resetar Senha</Text>
          <Text className="text-sm text-gray-500 mb-4">
            Nova senha para <Text className="font-medium">{residentName}</Text>. O interno deverá alterá-la no próximo acesso.
          </Text>

          <View className="bg-gray-100 rounded-xl px-4 py-3 flex-row items-center justify-between mb-2">
            <Text className="font-mono text-base text-gray-900 flex-1">
              {showPassword ? password : '•'.repeat(password.length)}
            </Text>
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} className="ml-2">
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <Text className="text-xs text-gray-400 mb-4">
            Copie e envie ao interno via WhatsApp antes de confirmar.
          </Text>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-3 items-center"
            >
              <Text className="text-sm text-gray-600">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={mutation.isPending}
              className="flex-1 bg-[#272950] rounded-lg py-3 items-center"
            >
              <Text className="text-sm text-white font-medium">
                {mutation.isPending ? 'Salvando...' : 'Confirmar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
