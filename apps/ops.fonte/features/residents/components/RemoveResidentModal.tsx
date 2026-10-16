import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { House } from '@fonte/api-client';
import {
  RESIDENT_REMOVAL_LABELS,
  RESIDENT_ROW_ACTION_LABELS,
  RESIDENT_ROW_ACTIONS,
  findAdmissionDatesIssue,
  todayInSaoPaulo,
  type ResidentRemovalAction,
  type ResidentRowAction,
} from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
import { DatePickerModal } from '@/components/DatePickerModal';
import {
  useDischargeResident,
  useEvadeResident,
  useHouses,
  useTransferResident,
} from '../hooks/useResidentRemoval';

type Action = ResidentRemovalAction;

function formatDate(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

// Rótulo e descrição vêm de `@fonte/types` (story 196) — o `adm` mostra os
// mesmos. Ícone e cor são do RN e ficam aqui.
const ACTIONS: { key: Action; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'discharge', icon: 'exit-outline', color: '#9333ea' },
  { key: 'evade', icon: 'walk-outline', color: '#dc2626' },
  { key: 'transfer', icon: 'swap-horizontal-outline', color: '#2563eb' },
];

interface Props {
  visible: boolean;
  houseId: string;
  /**
   * `entryDate` (story 203) limita a data de saída: vem do objeto da lista ou da
   * contagem, que já está no cache offline — nada de buscar aqui.
   */
  resident: { id: string; name: string; entryDate?: string | null } | null;
  onClose: () => void;
  onSuccess: () => void;
  /**
   * Item do menu da lista (story 200): restringe as ações e dá o título. Sem
   * `mode` (contagem), as três ações e o título "Remover filho" de sempre.
   */
  mode?: ResidentRowAction;
}

export function RemoveResidentModal({ visible, houseId, resident, onClose, onSuccess, mode }: Props) {
  const [chosenAction, setSelectedAction] = useState<Action | null>(null);
  const actions = mode ? ACTIONS.filter((a) => RESIDENT_ROW_ACTIONS[mode].includes(a.key)) : ACTIONS;
  // Escolha que não pertence ao modo atual (sobra de uma abertura anterior) não
  // vale; com uma ação só (transferência) ela já vem selecionada.
  const selectedAction: Action | null =
    chosenAction && actions.some((a) => a.key === chosenAction)
      ? chosenAction
      : actions.length === 1
        ? actions[0].key
        : null;
  const title = mode ? RESIDENT_ROW_ACTION_LABELS[mode] : 'Remover filho';
  const [targetHouseId, setTargetHouseId] = useState<string | null>(null);
  // "Hoje" no fuso da operação (story 203): é o limite máximo da saída.
  const [exitDate, setExitDate] = useState(() => todayInSaoPaulo());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const { data: houses = [] } = useHouses();
  const dischargeMutation = useDischargeResident(houseId);
  const evadeMutation = useEvadeResident(houseId);
  const transferMutation = useTransferResident(houseId);
  const submitDischarge = useFieldSubmit(dischargeMutation);
  const submitEvade = useFieldSubmit(evadeMutation);
  const submitTransfer = useFieldSubmit(transferMutation);

  const isPending = dischargeMutation.isPending || evadeMutation.isPending || transferMutation.isPending;
  const otherHouses = houses.filter((h: House) => h.id !== houseId);

  function handleOpen() {
    setSelectedAction(null);
    setTargetHouseId(null);
    setExitDate(todayInSaoPaulo());
  }

  function done() {
    onSuccess();
    onClose();
  }

  /**
   * Sem sinal a mudança de situação entra na fila (story 171) e o modal fecha na
   * hora. Se o backend recusar a transição no replay (regra de status é do
   * service — `BUSINESS_RULES.md`), o item aparece em "Não enviadas" com o
   * motivo, nunca some em silêncio.
   */
  const handlers = {
    onSent: done,
    onQueued: () => {
      done();
      Alert.alert(
        'Salvo no aparelho',
        'Sem conexão agora: a mudança será enviada assim que a conexão voltar.',
      );
    },
    onFailed: (error: unknown) =>
      Alert.alert('Erro', getErrorMessage(error, 'Não foi possível concluir a ação.')),
  };

  function handleConfirm() {
    if (!resident || !selectedAction || confirmDisabled) return;
    if (selectedAction === 'discharge') {
      submitDischarge({ residentId: resident.id, exitDate }, handlers);
    } else if (selectedAction === 'evade') {
      submitEvade({ residentId: resident.id, exitDate }, handlers);
    } else if (selectedAction === 'transfer' && targetHouseId) {
      submitTransfer({ residentId: resident.id, targetHouseId }, handlers);
    }
  }

  const needsExitDate = selectedAction === 'discharge' || selectedAction === 'evade';
  // Story 203: saída entre a entrada e hoje. Validado aqui para o lançamento não
  // entrar na fila offline já condenado ao 400 do backend.
  const today = todayInSaoPaulo();
  const entryDate = resident?.entryDate ? resident.entryDate.slice(0, 10) : undefined;
  const exitDateError = needsExitDate
    ? findAdmissionDatesIssue(
        { entryDate, exitDate },
        { today, check: { entryDate: false, exitDate: true } },
      )?.message
    : undefined;
  const confirmDisabled =
    isPending ||
    !selectedAction ||
    (selectedAction === 'transfer' && !targetHouseId) ||
    (needsExitDate && !exitDate) ||
    !!exitDateError;

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onShow={handleOpen}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '85%' }}>
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">{title}</Text>
              {resident ? <Text className="text-xs text-gray-400 mt-0.5">{resident.name}</Text> : null}
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {actions.length > 1 ? (
              <Text className="text-sm text-gray-500">O que deseja fazer?</Text>
            ) : null}
            {actions.length > 1 && actions.map((action) => {
              const selected = selectedAction === action.key;
              const { label, description } = RESIDENT_REMOVAL_LABELS[action.key];
              return (
                <TouchableOpacity
                  key={action.key}
                  className={`flex-row items-center rounded-xl border p-3 ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
                  onPress={() => setSelectedAction(action.key)}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: `${action.color}20` }}
                  >
                    <Ionicons name={action.icon} size={20} color={action.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900">{label}</Text>
                    <Text className="text-xs text-gray-400">{description}</Text>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color="#2563eb" /> : null}
                </TouchableOpacity>
              );
            })}

            {needsExitDate ? (
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5 mt-2">Data do acontecimento *</Text>
                <TouchableOpacity
                  className="border border-gray-300 rounded-lg px-3 py-2.5 flex-row items-center justify-between"
                  onPress={() => setDatePickerOpen(true)}
                >
                  <Text className={`text-sm ${exitDate ? 'text-gray-900' : 'text-gray-400'}`}>
                    {exitDate ? formatDate(exitDate) : 'Selecionar data'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                </TouchableOpacity>
                {exitDateError ? (
                  <Text className="text-xs text-red-600 mt-1">{exitDateError}</Text>
                ) : null}
              </View>
            ) : null}

            {selectedAction === 'transfer' ? (
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5 mt-2">Casa de destino *</Text>
                {otherHouses.length === 0 ? (
                  <Text className="text-sm text-gray-400">Nenhuma outra casa disponível.</Text>
                ) : (
                  <View className="border border-gray-200 rounded-xl overflow-hidden">
                    {otherHouses.map((h: House) => (
                      <TouchableOpacity
                        key={h.id}
                        className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${targetHouseId === h.id ? 'bg-blue-50' : 'bg-white'}`}
                        onPress={() => setTargetHouseId(h.id)}
                      >
                        <View className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${targetHouseId === h.id ? 'border-blue-500' : 'border-gray-300'}`}>
                          {targetHouseId === h.id ? <View className="w-2 h-2 rounded-full bg-blue-500" /> : null}
                        </View>
                        <Text className="text-sm text-gray-900">{h.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </ScrollView>

          <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
              onPress={onClose}
              disabled={isPending}
            >
              <Text className="text-sm font-medium text-gray-600">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-xl py-3 items-center ${confirmDisabled ? 'bg-gray-300' : 'bg-red-600'}`}
              onPress={handleConfirm}
              disabled={confirmDisabled}
            >
              {isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-sm font-medium text-white">Confirmar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    <DatePickerModal
      visible={datePickerOpen}
      value={exitDate}
      minimumDate={entryDate}
      maximumDate={today}
      onClose={() => setDatePickerOpen(false)}
      onChange={setExitDate}
    />
    </>
  );
}
