import { ScrollView, View } from 'react-native';
import { Role } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHouseById } from '../hooks/useHouseSettings';
import { BedCapacityForm } from '../components/BedCapacityForm';
import { HousePhotoGallery } from '../components/HousePhotoGallery';

export function HouseSettingsPage() {
  const { staff } = useAuth();
  const { data: house, isLoading, error, refetch } = useHouseById(staff?.houseId);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState onRetry={() => refetch()} />;
  if (!house || !staff) return <EmptyState message="Casa não encontrada." />;

  const isHouseCoordinator =
    staff.user.role === Role.COORDINATOR && house.coordinatorId === staff.id;

  if (!isHouseCoordinator) {
    return <EmptyState message="Apenas o coordenador da casa pode acessar as configurações." />;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-4 py-4 space-y-4">
        <HousePhotoGallery house={house} />
        <BedCapacityForm house={house} />
      </View>
    </ScrollView>
  );
}
