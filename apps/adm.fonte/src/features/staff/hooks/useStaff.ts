import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { StaffPermissionType } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { CreateStaffInput, UpdateStaffInput, UpdateStaffMeInput } from '@fonte/api-client';

export function useStaffMe() {
  return useQuery({
    queryKey: queryKeys.staffMe.current,
    queryFn: () => api.staff.me(),
  });
}

export function useUpdateStaffMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, photo }: { data: UpdateStaffMeInput; photo?: Blob | null }) => {
      await api.staff.updateMe(data);
      if (photo) {
        const fd = new window.FormData();
        fd.append('file', photo, 'photo.jpg');
        await api.staff.uploadPhotoMe(fd);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staffMe.current });
    },
  });
}

// Story 128 — envia a assinatura desenhada (PNG transparente) do próprio usuário.
export function useUploadMySignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blob: Blob) => {
      const fd = new window.FormData();
      fd.append('file', blob, 'signature.png');
      await api.staff.uploadMySignature(fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staffMe.current });
    },
  });
}

// Story 138 — remove a assinatura do próprio perfil (botão "Redefinir").
export function useRemoveMySignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.staff.removeMySignature(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staffMe.current });
    },
  });
}

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
    mutationFn: async ({ data, photo }: { data: UpdateStaffInput; photo?: Blob | null }) => {
      await api.staff.update(id, data);
      if (photo) {
        const fd = new window.FormData();
        fd.append('file', photo, 'photo.jpg');
        await api.staff.uploadPhoto(id, fd);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.detail(id) });
    },
  });
}

export function useResetStaffPassword(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api.staff.update(id, { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all });
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

// ─── Anexos (story 98) ─────────────────────────────────────────────────────────

export function useStaffAttachments(staffId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.staff.attachments(staffId),
    queryFn: () => api.staff.listAttachments(staffId),
    enabled: (options?.enabled ?? true) && !!staffId,
  });
}

export function useUploadStaffAttachment(staffId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new window.FormData();
      fd.append('file', file);
      return api.staff.uploadAttachment(staffId, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.attachments(staffId) });
    },
  });
}

export function useDeleteStaffAttachment(staffId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => api.staff.deleteAttachment(staffId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.attachments(staffId) });
    },
  });
}

export function useStaffPermissions(staffId: string) {
  return useQuery({
    queryKey: queryKeys.staff.permissions(staffId),
    queryFn: () => api.staff.getPermissions(staffId),
    enabled: !!staffId,
  });
}

export function useAddStaffPermission(staffId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: StaffPermissionType) => api.staff.addPermission(staffId, { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.permissions(staffId) });
    },
  });
}

export function useRemoveStaffPermission(staffId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: StaffPermissionType) => api.staff.removePermission(staffId, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.permissions(staffId) });
    },
  });
}
