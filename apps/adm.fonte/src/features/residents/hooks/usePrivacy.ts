import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { ConsentPurpose } from '@fonte/api-client';

// LGPD — consentimento, auditoria e direitos do titular de um interno.

export function useResidentConsents(residentId: string) {
  return useQuery({
    queryKey: queryKeys.residents.consents(residentId),
    queryFn: () => api.consents.status('RESIDENT', residentId),
    enabled: !!residentId,
  });
}

export function useGrantConsent(residentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (purpose: ConsentPurpose) =>
      api.consents.grant({ subjectType: 'RESIDENT', subjectId: residentId, purpose, termVersion: '1.0' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.residents.consents(residentId) });
      qc.invalidateQueries({ queryKey: queryKeys.residents.audit(residentId) });
    },
  });
}

export function useRevokeConsent(residentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (purpose: ConsentPurpose) =>
      api.consents.revoke({ subjectType: 'RESIDENT', subjectId: residentId, purpose }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.residents.consents(residentId) });
      qc.invalidateQueries({ queryKey: queryKeys.residents.audit(residentId) });
    },
  });
}

export function useResidentAudit(residentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.residents.audit(residentId),
    queryFn: () => api.audit.byTarget('resident', residentId),
    enabled: !!residentId && enabled,
  });
}

export function useAnonymizeResident(residentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.residents.anonymize(residentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
      qc.invalidateQueries({ queryKey: queryKeys.residents.all });
    },
  });
}
