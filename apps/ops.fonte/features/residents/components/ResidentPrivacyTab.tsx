import { Switch, Text, View } from 'react-native';
import type { ConsentPurpose } from '@fonte/api-client';
import { LoadingState } from '@/components/shared/LoadingState';
import { useResidentConsents, useToggleResidentConsent } from '../hooks/useResidentConsents';

const PURPOSE_LABELS: Record<ConsentPurpose, { title: string; desc: string }> = {
  IMAGE_PUBLICATION: {
    title: 'Uso de imagem',
    desc: 'Autorização para uso da imagem do filho em divulgação da Comunidade.',
  },
  RELIGIOUS_DISCLOSURE: {
    title: 'Divulgação religiosa',
    desc: 'Autorização para divulgação de testemunho/participação religiosa.',
  },
};

const PURPOSES: ConsentPurpose[] = ['IMAGE_PUBLICATION', 'RELIGIOUS_DISCLOSURE'];

export function ResidentPrivacyTab({ residentId }: { residentId: string }) {
  const { data: consents = [], isLoading } = useResidentConsents(residentId);
  const toggle = useToggleResidentConsent(residentId);

  if (isLoading) return <LoadingState />;

  return (
    <View className="px-4 py-4">
      <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">Consentimentos (LGPD)</Text>
      <View className="gap-3">
        {PURPOSES.map((purpose) => {
          const status = consents.find((c) => c.purpose === purpose);
          const granted = status?.granted ?? false;
          const label = PURPOSE_LABELS[purpose];
          return (
            <View key={purpose} className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900">{label.title}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">{label.desc}</Text>
              </View>
              <Switch
                value={granted}
                disabled={toggle.isPending}
                onValueChange={() => toggle.mutate({ purpose, granted })}
                trackColor={{ true: '#2563eb', false: '#d1d5db' }}
              />
            </View>
          );
        })}
      </View>
      <Text className="text-xs text-gray-400 mt-4">
        Saúde/tratamento não dependem de consentimento (tutela da saúde). Registre o consentimento ao colher a assinatura no acolhimento.
      </Text>
    </View>
  );
}
