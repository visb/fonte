import { useMutation, useQuery } from '@tanstack/react-query';
import type { SubscribeInput } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Dados públicos do associado para pré-preencher o checkout (GET por token). */
export function useAssociatePublic(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.associate.byToken(token ?? ''),
    queryFn: () => api.associates.public.getByToken(token!),
    enabled: !!token,
    retry: false,
  });
}

/** Adesão à contribuição mensal recorrente (POST subscribe). */
export function useSubscribe(token: string) {
  return useMutation({
    mutationFn: (data: SubscribeInput) =>
      api.associates.public.subscribe(token, data),
  });
}
