import { ScrollView, Switch, Text, View } from 'react-native';
import type { ConsentPurpose } from '@fonte/api-client';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useMyConsents, useToggleConsent } from '../hooks/usePrivacyConsents';

const PURPOSE_LABELS: Record<ConsentPurpose, { title: string; desc: string }> = {
  IMAGE_PUBLICATION: {
    title: 'Uso de imagem',
    desc: 'Autorizo o uso da minha imagem em divulgação institucional e campanhas da Comunidade.',
  },
  RELIGIOUS_DISCLOSURE: {
    title: 'Divulgação religiosa',
    desc: 'Autorizo a divulgação de testemunho e informações sobre minha participação religiosa.',
  },
};

const PURPOSES: ConsentPurpose[] = ['IMAGE_PUBLICATION', 'RELIGIOUS_DISCLOSURE'];

export function PrivacyPage() {
  const { data: consents = [], isLoading, isError, refetch } = useMyConsents();
  const toggle = useToggleConsent();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text className="text-lg font-semibold text-gray-900 mb-1">Privacidade e dados pessoais</Text>
      <Text className="text-sm text-gray-600 mb-4">
        A Comunidade trata seus dados conforme a LGPD (Lei nº 13.709/2018). Dados ligados ao acolhimento e
        à saúde são tratados com base na tutela da saúde e na execução do atendimento. O uso de imagem e a
        divulgação religiosa dependem do seu consentimento, que você pode conceder ou revogar a qualquer momento abaixo.
      </Text>

      <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Meus consentimentos</Text>
      <View className="space-y-3">
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
                trackColor={{ true: '#7c3aed', false: '#d1d5db' }}
              />
            </View>
          );
        })}
      </View>

      <Text className="text-xs text-gray-400 mt-6">
        Para exercer outros direitos (acesso, correção, exclusão) ou tirar dúvidas, fale com a coordenação da casa.
      </Text>
    </ScrollView>
  );
}
