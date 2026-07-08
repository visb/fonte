import { Text, TouchableOpacity, View } from 'react-native';
import type { Resident } from '@fonte/api-client';

function fmt(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="py-2.5 border-b border-gray-100 flex-row">
      <Text className="text-sm text-gray-500 w-36">{label}</Text>
      <Text className="text-sm text-gray-900 flex-1">{value || '—'}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-1">
      {children}
    </Text>
  );
}

interface Props {
  resident: Resident;
  onChangeMinistry: () => void;
  onResetPassword: () => void;
  onDeclareProducts: () => void;
}

export function ResidentOverviewTab({
  resident,
  onChangeMinistry,
  onResetPassword,
  onDeclareProducts,
}: Props) {
  return (
    <View className="px-4 py-4">
      <SectionLabel>Contribuição</SectionLabel>
      <TouchableOpacity
        accessibilityLabel="Declarar contribuição de produtos"
        onPress={onDeclareProducts}
        className="py-2.5 border-b border-gray-100 flex-row items-center"
      >
        <Text className="text-sm text-blue-600 font-medium flex-1">
          Declarar contribuição de produtos
        </Text>
        <Text className="text-sm text-blue-600">›</Text>
      </TouchableOpacity>

      <SectionLabel>Ministério</SectionLabel>
      <View className="py-2.5 border-b border-gray-100 flex-row items-center">
        <Text className="text-sm text-gray-500 w-36">Atual</Text>
        <Text className="text-sm text-gray-900 flex-1">{resident.ministry?.name ?? '—'}</Text>
        <TouchableOpacity onPress={onChangeMinistry} className="ml-2">
          <Text className="text-sm text-blue-600 font-medium">Alterar</Text>
        </TouchableOpacity>
      </View>

      <SectionLabel>Identificação</SectionLabel>
      <Row label="Nome" value={resident.name} />
      <Row label="CPF" value={resident.cpf} />
      <Row label="Data de nasc." value={fmt(resident.birthDate)} />
      <Row
        label="Gênero"
        value={resident.gender === 'MALE' ? 'Masculino' : resident.gender === 'FEMALE' ? 'Feminino' : null}
      />

      <SectionLabel>Internamento</SectionLabel>
      <Row label="Casa" value={resident.house?.name} />
      <Row label="Entrada" value={fmt(resident.entryDate)} />
      <Row label="Telefone" value={resident.contactPhone} />

      <SectionLabel>Saúde</SectionLabel>
      <Row label="Problemas de saúde" value={resident.healthIssues} />
      <Row label="Medicação contínua" value={resident.continuousMedication} />

      <SectionLabel>Acesso Digital</SectionLabel>
      <View className="py-2.5 border-b border-gray-100 flex-row items-center">
        {resident.userId ? (
          <>
            <Text className="text-sm text-gray-500 w-36">Status</Text>
            <Text className="text-sm text-gray-900 flex-1">Ativo</Text>
            <TouchableOpacity onPress={onResetPassword} className="ml-2">
              <Text className="text-sm text-blue-600 font-medium">Resetar senha</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text className="text-sm text-gray-400">Sem acesso gerado (use o adm)</Text>
        )}
      </View>
    </View>
  );
}
