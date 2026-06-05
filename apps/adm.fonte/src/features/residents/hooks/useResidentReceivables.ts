import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateContributionPlanInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useResidentReceivables(residentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.residents.receivables(residentId),
    queryFn: () => api.residents.getReceivables(residentId),
    enabled: (options?.enabled ?? true) && !!residentId,
  });
}

function useReceivableInvalidation(residentId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.residents.receivables(residentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
    queryClient.invalidateQueries({ queryKey: ['billing', 'filhos'] });
  };
}

export function useRegisterReceivablePayment(residentId: string) {
  const invalidate = useReceivableInvalidation(residentId);
  return useMutation({
    mutationFn: ({
      receivableId,
      paidAt,
      paymentMethod,
      paidAmount,
      paidFamilyInvestment,
      notes,
      file,
    }: {
      receivableId: string;
      paidAt: string;
      paymentMethod: string;
      paidAmount?: number;
      paidFamilyInvestment?: string;
      notes?: string;
      file?: File | null;
    }) => {
      const fd = new window.FormData();
      fd.append('paidAt', paidAt);
      fd.append('paymentMethod', paymentMethod);
      if (paidAmount != null) fd.append('paidAmount', String(paidAmount));
      if (paidFamilyInvestment) fd.append('paidFamilyInvestment', paidFamilyInvestment);
      if (notes) fd.append('notes', notes);
      if (file) fd.append('file', file);
      return api.residents.registerReceivablePayment(residentId, receivableId, fd);
    },
    onSuccess: invalidate,
  });
}

export function useReopenReceivable(residentId: string) {
  const invalidate = useReceivableInvalidation(residentId);
  return useMutation({
    mutationFn: (receivableId: string) => api.residents.reopenReceivable(residentId, receivableId),
    onSuccess: invalidate,
  });
}

export function useUpdateContributionPlan(residentId: string) {
  const invalidate = useReceivableInvalidation(residentId);
  return useMutation({
    mutationFn: (data: UpdateContributionPlanInput) =>
      api.residents.updateContributionPlan(residentId, data),
    onSuccess: invalidate,
  });
}

export function useSetContributionExempt(residentId: string) {
  const invalidate = useReceivableInvalidation(residentId);
  return useMutation({
    mutationFn: (exempt: boolean) => api.residents.setContributionExempt(residentId, exempt),
    onSuccess: invalidate,
  });
}
