import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Dados públicos da tela de autocancelamento (GET por token — story 45). */
export function useAssociateCancelView(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.associate.cancelView(token ?? ''),
    queryFn: () => api.associates.public.getCancelView(token!),
    enabled: !!token,
    retry: false,
  });
}

/** Cancelamento da assinatura pelo associado (POST cancel — idempotente). */
export function useCancelByToken(token: string) {
  return useMutation({
    mutationFn: () => api.associates.public.cancelByToken(token),
  });
}
