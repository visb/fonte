import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { ConsentPurpose } from '@fonte/api-client';

export function useMyConsents() {
  return useQuery({
    queryKey: queryKeys.consents,
    queryFn: () => api.consents.myStatus(),
  });
}

export function useToggleConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ purpose, granted }: { purpose: ConsentPurpose; granted: boolean }) =>
      granted ? api.consents.myRevoke(purpose) : api.consents.myGrant(purpose),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consents });
    },
  });
}
