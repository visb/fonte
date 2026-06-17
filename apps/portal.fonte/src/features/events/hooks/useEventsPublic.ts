import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegisterToEventInput } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Lista pública de eventos abertos (futuros). */
export function usePublicEvents() {
  return useQuery({
    queryKey: queryKeys.events.list,
    queryFn: () => api.events.public.list(),
  });
}

/** Detalhe público de um evento. */
export function usePublicEventById(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.events.detail(id ?? ''),
    queryFn: () => api.events.public.getById(id!),
    enabled: !!id,
    retry: false,
  });
}

/** Inscrição pública no evento. */
export function useRegisterToEvent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterToEventInput) => api.events.public.register(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id) }),
  });
}
