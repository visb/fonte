import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { CreateStaffInput, UpdateStaffInput } from '@fonte/api-client';

export function useStaff(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.staff.all,
    queryFn: () => api.staff.list(),
    enabled: options?.enabled ?? true,
  });
}

export function useStaffById(id: string) {
  return useQuery({
    queryKey: queryKeys.staff.detail(id),
    queryFn: () => api.staff.getById(id),
    enabled: !!id,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStaffInput) => api.staff.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all });
    },
  });
}

export function useUpdateStaff(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateStaffInput) => api.staff.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.detail(id) });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.staff.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all });
    },
  });
}
