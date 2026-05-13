import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type {
  CreateResidentInput,
  GenerateResidentAccessInput,
  GenerateRelativeAccessInput,
  UpdateResidentInput,
} from '@fonte/api-client';

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

export function useGenerateResidentAccess(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateResidentAccessInput) =>
      api.residents.generateAccess(residentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
    },
  });
}

export function useResetResidentPassword(residentId: string) {
  return useMutation({
    mutationFn: (password: string) =>
      api.residents.resetPassword(residentId, { password }),
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

export function useResidentDocuments(residentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.residents.documents(residentId),
    queryFn: () => api.residents.getDocuments(residentId),
    enabled: (options?.enabled ?? true) && !!residentId,
  });
}

export function useResidentAttachments(residentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.residents.attachments(residentId),
    queryFn: () => api.residents.getAttachments(residentId),
    enabled: (options?.enabled ?? true) && !!residentId,
  });
}

export function useAddAttachment(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new window.FormData();
      fd.append('file', file);
      return api.residents.addAttachment(residentId, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.attachments(residentId) });
    },
  });
}

export function useDeleteAttachment(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => api.residents.deleteAttachment(residentId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.attachments(residentId) });
    },
  });
}

export function useGenerateRelativeAccess(relativeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateRelativeAccessInput) =>
      api.relatives.generateAccess(relativeId, data),
    onSuccess: (_data, _vars, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['relatives'] });
    },
  });
}

export function useResetRelativePassword(relativeId: string) {
  return useMutation({
    mutationFn: (password: string) =>
      api.relatives.resetPassword(relativeId, { password }),
  });
}

export function useUploadSignedDocument(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, file }: { templateId: string; file: File }) => {
      const fd = new window.FormData();
      fd.append('file', file);
      return api.residents.uploadSignedDocument(residentId, templateId, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.documents(residentId) });
    },
  });
}
