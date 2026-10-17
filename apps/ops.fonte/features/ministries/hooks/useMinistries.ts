import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Story 204: a lista de servos da casa (`staff.byHouse`) traz os ministérios
 * que cada um lidera — mudar líder/criar/excluir ministério a deixa velha.
 */
function invalidateHouseStaff(queryClient: QueryClient, houseId: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.staff.byHouse(houseId) });
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
    // Story 197: sem membros para adicionar, sobra criar + definir o líder.
    mutationFn: async ({
      name,
      leaderId,
      leaderType,
    }: {
      name: string;
      leaderId?: string | null;
      leaderType?: 'STAFF' | null;
    }) => {
      const ministry = await api.houses.addMinistry(houseId, { name });
      if (leaderId && leaderType) {
        await api.ministries.update(ministry.id, { leaderId, leaderType });
      }
      return ministry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) });
      invalidateHouseStaff(queryClient, houseId);
    },
  });
}

export function useUpdateMinistry(ministryId: string, houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; leaderId?: string | null; leaderType?: 'STAFF' | null }) =>
      api.ministries.update(ministryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.detail(ministryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) });
      invalidateHouseStaff(queryClient, houseId);
    },
  });
}

export function useDeleteMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ministryId: string) => api.ministries.delete(ministryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) });
      invalidateHouseStaff(queryClient, houseId);
    },
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
