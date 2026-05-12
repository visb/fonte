import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IncidentSeverity } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

interface CreateIncidentInput {
  date: string;
  severity: IncidentSeverity;
  description: string;
  houseId: string;
  responsibleId: string;
  residentId: string | null;
}

export function useIncidents(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.incidents.byHouse(houseId!),
    queryFn: () => api.incidents.list({ houseId: houseId! }),
    enabled: !!houseId,
  });
}

export function useIncidentsToday(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.incidents.todayByHouse(houseId!),
    queryFn: () => api.incidents.list({ houseId: houseId! }),
    enabled: !!houseId,
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIncidentInput) => api.incidents.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incidents.all });
    },
  });
}
