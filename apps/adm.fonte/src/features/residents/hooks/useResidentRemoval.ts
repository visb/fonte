import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateResidentInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toastError, toastSuccess } from '@/lib/toast';

/**
 * Baixa de filho pela lista do `adm` (story 196): alta, evasão ou transferência.
 *
 * Mesma rota da contagem do `ops` (`PATCH /residents/:id`), sem outbox — o `adm`
 * é web com sinal. O 400 do guard de transição do service chega aqui como erro
 * normal e vira toast com a frase do backend (`getErrorMessage` dentro de
 * `toastError`).
 */
export function useRemoveResident(resident: { id: string; houseId?: string | null }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateResidentInput) => api.residents.update(resident.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(resident.id) });
      // Listagem por casa: a linha precisa sumir da casa de origem também na
      // transferência, onde o status não muda.
      if (resident.houseId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.houses.residents(resident.houseId) });
      }
      toastSuccess('Situação do filho atualizada.');
    },
    onError: (error) => toastError(error, 'Erro ao remover o filho da casa.'),
  });
}
