import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EventPaymentStatus, type PayEventInput } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Dados da inscrição p/ a página de pagamento (story 70). Enquanto o pagamento
 * estiver PENDING, faz polling (refetch) p/ refletir a confirmação do webhook —
 * útil no PIX, em que o pagamento ocorre fora do app.
 */
export function useEventPaymentByToken(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.eventPayment.byToken(token ?? ''),
    queryFn: () => api.events.payments.getByToken(token!),
    enabled: !!token,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.paymentStatus === EventPaymentStatus.PENDING ? 5000 : false,
  });
}

/** Cria a cobrança (cartão/PIX) por token (story 70). */
export function usePayEvent(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PayEventInput) => api.events.payments.pay(token, data),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.eventPayment.byToken(token),
      }),
  });
}
