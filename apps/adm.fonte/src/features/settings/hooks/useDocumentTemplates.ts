import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { TemplateKind } from '@fonte/types';
import type { CreateDocumentTemplateInput, UpdateDocumentTemplateInput } from '@fonte/api-client';

/**
 * Story 178 — lista de templates POR TIPO. O default `RESIDENT` mantém os
 * consumidores de documento do acolhido (aba de Anexos, wizard) exatamente como
 * estavam: eles não sabem — nem precisam saber — que recibos existem.
 */
export function useDocumentTemplates(
  kind: TemplateKind = TemplateKind.RESIDENT,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.documentTemplates.byKind(kind),
    queryFn: () => api.documentTemplates.list({ kind }),
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

