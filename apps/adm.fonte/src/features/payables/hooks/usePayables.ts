import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePayableInput,
  ListPayablesParams,
  PayablesSummaryParams,
  PayPayableInput,
  UpdatePayableInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function usePayables(filters: ListPayablesParams = {}) {
  return useQuery({
    queryKey: queryKeys.payables.list(filters),
    queryFn: () => api.payables.list(filters),
  });
}

export function usePayableSummary(filters: PayablesSummaryParams = {}) {
  return useQuery({
    queryKey: queryKeys.payables.summary(filters),
    queryFn: () => api.payables.summary(filters),
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.payables.all });
}

export function useCreatePayable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePayableInput) => api.payables.create(data),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdatePayable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePayableInput }) =>
      api.payables.update(id, data),
    onSuccess: (_data, { id }) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.payables.detail(id) });
    },
  });
}

export function usePayPayable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: PayPayableInput }) =>
      api.payables.pay(id, data),
    onSuccess: (_data, { id }) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.payables.detail(id) });
    },
  });
}

export function useDeletePayable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.payables.remove(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUploadPayableAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new window.FormData();
      fd.append('file', file);
      return api.payables.uploadAttachment(id, fd);
    },
    onSuccess: (_data, { id }) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.payables.detail(id) });
    },
  });
}

export function useDeletePayableAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.payables.removeAttachment(id),
    onSuccess: (_data, id) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.payables.detail(id) });
    },
  });
}
