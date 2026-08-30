import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { STATS_REFETCH_INTERVAL_MS } from '../constants';

/**
 * Tela viva (story 192): o poll de 10s é o intervalo mínimo aceitável — cada
 * poll é ele próprio uma requisição que entra na medição.
 */
export function useObservabilityStats() {
  return useQuery({
    queryKey: queryKeys.observability.stats,
    queryFn: () => api.observability.stats(),
    refetchInterval: STATS_REFETCH_INTERVAL_MS,
  });
}

/**
 * Zera a janela do agregado sem reiniciar a API — serve para medir um fluxo
 * específico ("zera, roda o fluxo, olha o custo").
 */
export function useResetObservability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.observability.reset(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.observability.stats }),
  });
}
