import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';

export default function Index() {
  const { staff, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && staff && !staff.houseId) {
      router.replace('/(app)/support-groups');
    }
  }, [staff, isLoading]);

  if (isLoading || !staff || !staff.houseId) return null;
  return <DashboardPage />;
}
