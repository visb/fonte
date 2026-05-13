import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useSupportGroupCheckin() {
  return useMutation({
    mutationFn: (token: string) => api.supportGroups.addRelativeCheckin({ token }),
  });
}
