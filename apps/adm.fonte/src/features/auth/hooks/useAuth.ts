import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useChangePassword() {
  return useMutation({
    mutationFn: (newPassword: string) => api.auth.changePassword({ newPassword }),
  });
}
