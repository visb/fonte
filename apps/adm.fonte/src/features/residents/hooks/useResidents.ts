import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResidentStatus } from '@fonte/types';
import { FollowUpType, FollowUpAccessLevel } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type {
  Admission,
  CreateResidentInput,
  GenerateResidentAccessInput,
  GenerateRelativeAccessInput,
  ReadmitResidentInput,
  UpdateResidentInput,
} from '@fonte/api-client';

export function useInfiniteResidents(params: { search?: string; status?: ResidentStatus | ''; overdueContribution?: boolean }) {
  return useInfiniteQuery({
    queryKey: queryKeys.residents.list({ search: params.search, status: params.status, overdueContribution: params.overdueContribution }),
    queryFn: ({ pageParam }) =>
      api.residents.list({
        page: pageParam as number,
        limit: 20,
        search: params.search || undefined,
        status: (params.status as ResidentStatus) || undefined,
        overdueContribution: params.overdueContribution || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.length * 20;
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
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
    mutationFn: (data: { name: string; relationship?: string; phone?: string; isResponsible?: boolean }) =>
      api.relatives.create({
        name: data.name,
        residentId,
        phone: data.phone || null,
        relationship: data.relationship || null,
        isResponsible: data.isResponsible,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.relatives(residentId) });
    },
  });
}

export function useSetResponsibleRelative(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (relativeId: string) => api.relatives.setResponsible(relativeId),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.relativesAll });
    },
  });
}

export function useResetRelativePassword(relativeId: string) {
  return useMutation({
    mutationFn: (password: string) =>
      api.relatives.resetPassword(relativeId, { password }),
  });
}

export function useResidentAdmissions(residentId: string) {
  return useQuery<Admission[]>({
    queryKey: queryKeys.residents.admissions(residentId),
    queryFn: () => api.residents.getAdmissions(residentId),
    enabled: !!residentId,
  });
}

export function useReadmitResident(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      photo,
    }: {
      data: ReadmitResidentInput;
      photo?: Blob | null;
    }) => {
      const resident = await api.residents.readmit(residentId, data);
      if (photo) {
        const fd = new window.FormData();
        fd.append('file', photo, 'photo.jpg');
        await api.residents.uploadPhoto(resident.id, fd);
      }
      return resident;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.admissions(residentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
    },
  });
}

export function useDeclareContribution(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      description,
      file,
    }: {
      date: string;
      description?: string;
      file?: File | null;
    }) => {
      const followUp = await api.residents.createFollowUp(residentId, {
        type: FollowUpType.MONTHLY_CONTRIBUTION,
        date,
        accessLevel: FollowUpAccessLevel.ALL,
        description,
      });
      if (file) {
        const fd = new window.FormData();
        fd.append('file', file);
        await api.residents.uploadFollowUpAttachment(residentId, followUp.id, fd);
      }
      return followUp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.followUps(residentId) });
    },
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
