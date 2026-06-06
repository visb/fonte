import { Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ResidentStatus } from '@fonte/types';
import type { CreateResidentInput, Resident, CensusConcludeInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

// Census ("Contagem") is a rollout-only tool: it lists the active residents of a
// house so a coordinator can confirm who is really present, remove who isn't, and
// register residents missing from our records.

// Statuses shown on the census list: ACTIVE plus the ones added during this very
// census (CENSUS_ADDED) — they are present, just awaiting ADM approval.
const CENSUS_VISIBLE_STATUSES: ResidentStatus[] = [
  ResidentStatus.ACTIVE,
  ResidentStatus.CENSUS_ADDED,
];

export function useActiveResidentsByHouse(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.residents.byHouse(houseId!),
    queryFn: () => api.residents.listByHouse(houseId!),
    enabled: !!houseId,
    select: (residents: Resident[]) =>
      residents.filter((r) => CENSUS_VISIBLE_STATUSES.includes(r.status)),
  });
}

export function useHouses() {
  return useQuery({
    queryKey: queryKeys.houses.all,
    queryFn: () => api.houses.list(),
  });
}

function invalidateHouseResidents(
  queryClient: ReturnType<typeof useQueryClient>,
  houseId: string,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.residents.byHouse(houseId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.residents.countByHouse(houseId) });
}

interface PhotoInput {
  uri: string;
  type: string;
}

async function buildPhotoFormData({ uri, type }: PhotoInput): Promise<FormData> {
  const fd = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    fd.append('file', blob, 'photo.jpg');
  } else {
    fd.append('file', { uri, name: 'photo.jpg', type } as unknown as Blob);
  }
  return fd;
}

// Adds a resident during the census: created as CENSUS_ADDED (pending ADM approval)
// and the ADM is notified. Uploads the photo right after — the photo endpoint needs
// the resident id.
export function useCensusAddResident(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, photo }: { data: CreateResidentInput; photo?: PhotoInput }) => {
      const resident = await api.census.addResident(data);
      if (photo) {
        const fd = await buildPhotoFormData(photo);
        await api.residents.uploadPhoto(resident.id, fd as unknown as globalThis.FormData);
      }
      return resident;
    },
    onSuccess: () => invalidateHouseResidents(queryClient, houseId),
  });
}

// Concludes the census ("chamada"): notifies the ADM. When residents were added
// during the count, the ADM notification offers a review action.
export function useConcludeCensus(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CensusConcludeInput) => api.census.conclude(data),
    onSuccess: () => invalidateHouseResidents(queryClient, houseId),
  });
}

// Discharge ("alta"): status DISCHARGED + exit date = event date.
export function useDischargeResident(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ residentId, exitDate }: { residentId: string; exitDate: string }) =>
      api.residents.update(residentId, {
        status: ResidentStatus.DISCHARGED,
        exitDate,
      }),
    onSuccess: () => invalidateHouseResidents(queryClient, houseId),
  });
}

// Evasion ("evasão"): status EVADED + exit date = event date.
export function useEvadeResident(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ residentId, exitDate }: { residentId: string; exitDate: string }) =>
      api.residents.update(residentId, {
        status: ResidentStatus.EVADED,
        exitDate,
      }),
    onSuccess: () => invalidateHouseResidents(queryClient, houseId),
  });
}

// Transfer: move the resident to another house, keeping the ACTIVE status.
export function useTransferResident(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ residentId, targetHouseId }: { residentId: string; targetHouseId: string }) =>
      api.residents.update(residentId, { houseId: targetHouseId }),
    onSuccess: () => invalidateHouseResidents(queryClient, houseId),
  });
}
