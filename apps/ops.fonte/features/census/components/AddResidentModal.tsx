import { useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ResidentLookupItem as LookupCandidate } from '@fonte/types';
import { useFindReadmitCandidate } from '../hooks/useCensus';
import { prefillFromTerm } from '../lib/readmitSchema';
import { AddResidentForm } from './AddResidentForm';
import { AddResidentReturningStep } from './AddResidentReturningStep';
import { ReadmitConfirmStep } from './ReadmitConfirmStep';
import { ResidentLookupStep } from './ResidentLookupStep';

interface Props {
  visible: boolean;
  houseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step =
  | { kind: 'question' }
  | { kind: 'lookup' }
  | { kind: 'confirm'; candidate: LookupCandidate }
  | { kind: 'form'; prefill?: { name?: string; cpf?: string } };

const TITLES: Record<Step['kind'], string> = {
  question: 'Adicionar filho',
  lookup: 'Buscar cadastro',
  confirm: 'Reacolher filho',
  form: 'Adicionar filho',
};

/**
 * Story 218 — "Adicionar filho" da contagem em passos: pergunta se o filho já
 * passou pela comunidade; se sim, busca o cadastro e reacolhe em vez de
 * duplicar; senão (ou nada encontrado), segue para o cadastro novo.
 */
export function AddResidentModal({ visible, houseId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'question' });
  const findCandidate = useFindReadmitCandidate();

  // Reabrir o modal começa sempre pela pergunta (o `onShow` cobre o nativo).
  function close() {
    setStep({ kind: 'question' });
    onClose();
  }

  function done() {
    onSuccess();
    close();
  }

  async function handleCpfConflict(
    conflict: { message: string; conflictResidentId: string | null },
    cpf: string,
  ) {
    const candidate = conflict.conflictResidentId
      ? await findCandidate(cpf, conflict.conflictResidentId)
      : null;
    // Dono em acolhimento (outra casa) não é reacolhível pela contagem.
    if (!candidate) return Alert.alert('Erro', conflict.message);
    Alert.alert('CPF já cadastrado', `${conflict.message}\nJá existe um cadastro com este CPF — reacolher?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reacolher', onPress: () => setStep({ kind: 'confirm', candidate }) },
    ]);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={() => setStep({ kind: 'question' })}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={close} />
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '90%' }}>
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <Text className="flex-1 text-base font-semibold text-gray-900">{TITLES[step.kind]}</Text>
            <Pressable accessibilityLabel="Fechar" onPress={close}>
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>

          {step.kind === 'question' ? (
            <AddResidentReturningStep
              onYes={() => setStep({ kind: 'lookup' })}
              onNo={() => setStep({ kind: 'form' })}
            />
          ) : null}
          {step.kind === 'lookup' ? (
            <ResidentLookupStep
              onSelect={(candidate) => setStep({ kind: 'confirm', candidate })}
              onNotFound={(term) => setStep({ kind: 'form', prefill: prefillFromTerm(term) })}
              onBack={() => setStep({ kind: 'question' })}
            />
          ) : null}
          {step.kind === 'confirm' ? (
            <ReadmitConfirmStep
              houseId={houseId}
              candidate={step.candidate}
              onBack={() => setStep({ kind: 'lookup' })}
              onDone={done}
            />
          ) : null}
          {step.kind === 'form' ? (
            <AddResidentForm
              houseId={houseId}
              prefill={step.prefill}
              onCancel={close}
              onDone={done}
              onCpfConflict={(conflict, cpf) => void handleCpfConflict(conflict, cpf)}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
