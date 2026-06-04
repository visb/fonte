import { Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ResidentStatus } from '@fonte/types';
import type { CreateResidentInput, Resident } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

// Census ("Contagem") is a rollout-only tool: it lists the active residents of a
// house so a coordinator can confirm who is really present, remove who isn't, and
// register residents missing from our records.

export function useActiveResidentsByHouse(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.residents.byHouse(houseId!),
    queryFn: () => api.residents.listByHouse(houseId!),
    enabled: !!houseId,
    select: (residents: Resident[]) =>
      residents.filter((r) => r.status === ResidentStatus.ACTIVE),
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

// Creates a resident already ACTIVE (census modality) and, when given, uploads its
// photo right after — the photo endpoint needs the resident id.
export function useCreateCensusResident(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, photo }: { data: CreateResidentInput; photo?: PhotoInput }) => {
      const resident = await api.residents.create(data);
      if (photo) {
        const fd = await buildPhotoFormData(photo);
        await api.residents.uploadPhoto(resident.id, fd as unknown as globalThis.FormData);
      }
      return resident;
    },
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
