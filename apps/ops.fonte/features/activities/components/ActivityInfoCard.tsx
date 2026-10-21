import { View, Text, TouchableOpacity } from 'react-native';
import type { Activity } from '@fonte/api-client';

function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR');
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-gray-100">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm font-medium text-gray-800 flex-1 text-right ml-3">{value}</Text>
    </View>
  );
}

interface ResponsibleRowProps {
  name: string;
  /** Só para quem pode trocar (story 220). */
  onChange?: () => void;
  isOnline: boolean;
}

function ResponsibleRow({ name, onChange, isOnline }: ResponsibleRowProps) {
  return (
    <View className="py-2 border-b border-gray-100">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-gray-500">Responsável</Text>
        <Text className="text-sm font-medium text-gray-800 flex-1 text-right ml-3">{name}</Text>
        {onChange && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Alterar responsável"
            accessibilityState={{ disabled: !isOnline }}
            disabled={!isOnline}
            onPress={onChange}
            className="ml-3"
            style={{ opacity: isOnline ? 1 : 0.5 }}
          >
            <Text className="text-sm font-semibold text-indigo-600">Alterar</Text>
          </TouchableOpacity>
        )}
      </View>
      {onChange && !isOnline && (
        <Text className="text-xs text-gray-400 mt-1 text-right">
          Precisa de conexão para trocar o responsável.
        </Text>
      )}
    </View>
  );
}

interface Props {
  activity: Activity;
  /** Abre o seletor de responsável; ausente = só leitura (servo, Concluída). */
  onChangeResponsible?: () => void;
  isOnline: boolean;
}

/** Quadro de informações do detalhe da atividade. */
export function ActivityInfoCard({ activity, onChangeResponsible, isOnline }: Props) {
  return (
    <View className="bg-white rounded-xl px-4 py-1 mb-5">
      <InfoRow label="Casa" value={activity.house?.name ?? 'Geral (sem casa)'} />
      <ResponsibleRow
        name={activity.responsible?.name ?? 'Não atribuído'}
        onChange={onChangeResponsible}
        isOnline={isOnline}
      />
      <InfoRow label="Criado por" value={activity.createdBy?.name ?? '—'} />
      <InfoRow label="Criada em" value={formatDateTime(activity.createdAt)} />
      <InfoRow label="Atualizada em" value={formatDateTime(activity.updatedAt)} />
    </View>
  );
}
