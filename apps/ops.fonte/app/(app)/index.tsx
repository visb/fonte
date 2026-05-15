import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';

export default function Index() {
  const { staff, isResident, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isResident) {
      router.replace('/(app)/resident-home');
    } else if (staff && !staff.houseId) {
      router.replace('/(app)/support-groups');
    }
  }, [staff, isResident, isLoading]);

  if (isLoading || !staff || !staff.houseId) return null;
  return <DashboardPage />;
}
