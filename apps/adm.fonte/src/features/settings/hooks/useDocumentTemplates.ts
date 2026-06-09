import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { CreateDocumentTemplateInput, UpdateDocumentTemplateInput } from '@fonte/api-client';

export function useDocumentTemplates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.documentTemplates.all,
    queryFn: () => api.documentTemplates.list(),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateDocumentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocumentTemplateInput) => api.documentTemplates.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documentTemplates.all });
    },
  });
}

export function useDeleteDocumentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.documentTemplates.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documentTemplates.all });
    },
  });
}

export function useUpdateDocumentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentTemplateInput }) =>
      api.documentTemplates.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documentTemplates.all });
    },
  });
}

