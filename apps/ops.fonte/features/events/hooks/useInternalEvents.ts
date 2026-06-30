import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Eventos internos (story 94), só-leitura. Acessível a todos os papéis de Staff;
 * os servos veem aqui a agenda de eventos voltada à equipe.
 */
export function useInternalEvents() {
  return useQuery({
    queryKey: queryKeys.events.internal,
    queryFn: () => api.events.listInternal(),
  });
}
