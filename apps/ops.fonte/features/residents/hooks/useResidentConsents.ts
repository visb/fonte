import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { ConsentPurpose } from '@fonte/api-client';

export function useResidentConsents(residentId: string) {
  return useQuery({
    queryKey: queryKeys.residents.consents(residentId),
    queryFn: () => api.consents.status('RESIDENT', residentId),
    enabled: !!residentId,
  });
}

export function useToggleResidentConsent(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ purpose, granted }: { purpose: ConsentPurpose; granted: boolean }) =>
      granted
        ? api.consents.revoke({ subjectType: 'RESIDENT', subjectId: residentId, purpose })
        : api.consents.grant({ subjectType: 'RESIDENT', subjectId: residentId, purpose, termVersion: '1.0' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.consents(residentId) });
    },
  });
}
