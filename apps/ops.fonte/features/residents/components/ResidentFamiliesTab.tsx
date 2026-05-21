import { ActivityIndicator, Text, View } from 'react-native';
import { useResidentRelatives } from '../hooks/useResidents';
import { RelativeCard } from './RelativeCard';

interface Props {
  residentId: string;
}

export function ResidentFamiliesTab({ residentId }: Props) {
  const { data: relatives = [], isLoading } = useResidentRelatives(residentId);

  if (isLoading) return <ActivityIndicator color="#2563eb" className="py-8" />;

  if (relatives.length === 0) {
    return (
      <Text className="text-sm text-gray-500 text-center py-12">
        Nenhum familiar cadastrado.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {relatives.map((relative) => (
        <RelativeCard key={relative.id} relative={relative} />
      ))}
    </View>
  );
}
