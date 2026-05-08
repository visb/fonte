import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { CreateResidentInput, UpdateResidentInput } from '@fonte/api-client';

export function useResidents() {
  return useQuery({
    queryKey: queryKeys.residents.all,
    queryFn: () => api.residents.list(),
  });
}

export function useResidentById(id: string) {
  return useQuery({
    queryKey: queryKeys.residents.detail(id),
    queryFn: () => api.residents.getById(id),
    enabled: !!id,
  });
}

export function useCreateResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      photo,
    }: {
      data: CreateResidentInput;
      photo?: Blob | null;
    }) => {
      const resident = await api.residents.create(data);
      if (photo) {
        const fd = new window.FormData();
        fd.append('file', photo, 'photo.jpg');
        await api.residents.uploadPhoto(resident.id, fd);
      }
      return resident;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
    },
  });
}

export function useUpdateResident(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      photo,
    }: {
      data: UpdateResidentInput;
      photo?: Blob | null;
    }) => {
      await api.residents.update(id, data);
      if (photo) {
        const fd = new window.FormData();
        fd.append('file', photo, 'photo.jpg');
        await api.residents.uploadPhoto(id, fd);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
    },
  });
}

export function useDeleteResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.residents.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
    },
  });
}

export function useResidentRelatives(residentId: string) {
  return useQuery({
    queryKey: queryKeys.residents.relatives(residentId),
    queryFn: () => api.relatives.listByResident(residentId),
    enabled: !!residentId,
  });
}

export function useAddRelative(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; relationship?: string; phone?: string }) =>
      api.relatives.create({
        name: data.name,
        residentId,
        phone: data.phone || null,
        relationship: data.relationship || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.relatives(residentId) });
    },
  });
}

export function useDeleteRelative(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (relativeId: string) => api.relatives.delete(relativeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.relatives(residentId) });
    },
  });
}
