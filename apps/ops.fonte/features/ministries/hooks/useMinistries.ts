import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useHouseResidentsForMinistry(houseId: string | null | undefined) {
  return useQuery({
    queryKey: ['house-residents-for-ministry', houseId!],
    queryFn: () => api.houses.listResidents(houseId!),
    enabled: !!houseId,
  });
}

export function useHouseStaffForMinistry(houseId: string | null | undefined) {
  return useQuery({
    queryKey: ['house-staff-for-ministry', houseId!],
    queryFn: () => api.houses.listStaff(houseId!),
    enabled: !!houseId,
  });
}

export function useMinistries(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.ministries.byHouse(houseId!),
    queryFn: () => api.houses.listMinistries(houseId!),
    enabled: !!houseId,
  });
}

export function useMinistryDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ministries.detail(id!),
    queryFn: () => api.ministries.getById(id!),
    enabled: !!id,
  });
}

export function useMinistryTasks(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ministries.tasks(id!),
    queryFn: () => api.ministries.listTasks(id!),
    enabled: !!id,
  });
}

export function useCreateMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      leaderId,
      leaderType,
      residentIds = [],
    }: {
      name: string;
      leaderId?: string | null;
      leaderType?: 'STAFF' | 'RESIDENT' | null;
      residentIds?: string[];
    }) => {
      const ministry = await api.houses.addMinistry(houseId, { name });
      const followUps: Promise<unknown>[] = [];
      if (leaderId && leaderType) {
        followUps.push(api.ministries.update(ministry.id, { leaderId, leaderType }));
      }
      for (const residentId of residentIds) {
        followUps.push(api.ministries.addResident(ministry.id, residentId));
      }
      await Promise.all(followUps);
      return ministry;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) }),
  });
}

export function useUpdateMinistry(ministryId: string, houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; leaderId?: string | null; leaderType?: 'STAFF' | 'RESIDENT' | null }) =>
      api.ministries.update(ministryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.detail(ministryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) });
    },
  });
}

export function useDeleteMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ministryId: string) => api.ministries.delete(ministryId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) }),
  });
}

export function useAddResident(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (residentId: string) => api.ministries.addResident(ministryId, residentId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.detail(ministryId) }),
  });
}

export function useRemoveResident(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (residentId: string) => api.ministries.removeResident(ministryId, residentId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.detail(ministryId) }),
  });
}

export function useAddStaff(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (staffId: string) => api.ministries.addStaff(ministryId, staffId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.detail(ministryId) }),
  });
}

export function useRemoveStaff(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (staffId: string) => api.ministries.removeStaff(ministryId, staffId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.detail(ministryId) }),
  });
}

export function useCreateTask(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; repetition?: 'NONE' | 'DAILY' }) =>
      api.ministries.createTask(ministryId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.tasks(ministryId) }),
  });
}

export function useUpdateTask(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: { title?: string; completed?: boolean; repetition?: 'NONE' | 'DAILY' } }) =>
      api.ministries.updateTask(ministryId, taskId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.tasks(ministryId) }),
  });
}

export function useDeleteTask(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.ministries.deleteTask(ministryId, taskId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.tasks(ministryId) }),
  });
}
