import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { CreateHouseInput, UpdateHouseInput } from '@fonte/api-client';
export function useHouses() {
  return useQuery({
    queryKey: queryKeys.houses.all,
    queryFn: () => api.houses.list(),
  });
}

export function useHouseById(id: string) {
  return useQuery({
    queryKey: queryKeys.houses.detail(id),
    queryFn: () => api.houses.getById(id),
    enabled: !!id,
  });
}

export function useCreateHouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHouseInput) => api.houses.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
    },
  });
}

export function useUpdateHouse(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateHouseInput) => api.houses.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.detail(id) });
    },
  });
}

export function useHouseStaff(houseId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.houses.staff(houseId),
    queryFn: () => api.houses.listStaff(houseId),
    enabled: options?.enabled ?? true,
  });
}

export function useHouseResidents(houseId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.houses.residents(houseId),
    queryFn: () => api.houses.listResidents(houseId),
    enabled: options?.enabled ?? true,
  });
}

export function useDeleteHouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.houses.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
    },
  });
}

export function useUploadHousePhoto(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.houses.addPhoto(houseId, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.detail(houseId) });
    },
  });
}

export function useHouseStoreroomItems(houseId: string) {
  return useQuery({
    queryKey: queryKeys.storeroom.byHouse(houseId),
    queryFn: () => api.storeroom.listItems({ houseId }),
    enabled: !!houseId,
  });
}

export function useHouseStoreroomMovements(houseId: string) {
  return useQuery({
    queryKey: queryKeys.storeroom.movementsByHouse(houseId),
    queryFn: () => api.storeroom.listMovements({ houseId }),
    enabled: !!houseId,
  });
}

export function useHouseSupplyRoomItems(houseId: string) {
  return useQuery({
    queryKey: queryKeys.supplyRoom.byHouse(houseId),
    queryFn: () => api.supplyRoom.listItems({ houseId }),
    enabled: !!houseId,
  });
}

export function useHouseSupplyRoomMovements(houseId: string) {
  return useQuery({
    queryKey: queryKeys.supplyRoom.movementsByHouse(houseId),
    queryFn: () => api.supplyRoom.listMovements({ houseId }),
    enabled: !!houseId,
  });
}

export function useDeleteHousePhoto(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => api.houses.deletePhoto(houseId, photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.detail(houseId) });
    },
  });
}

// ─── Pedidos de alteração de capacidade (ops → adm) ──────────────────────────

export function useCapacityRequestHistory(houseId: string) {
  return useQuery({
    queryKey: queryKeys.houses.capacityRequests(houseId),
    queryFn: () => api.houses.listCapacityRequests(houseId),
    enabled: !!houseId,
  });
}

export function useCapacityRequest(
  requestId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.houses.capacityRequest(requestId ?? ''),
    queryFn: () => api.houses.getCapacityRequest(requestId as string),
    enabled: !!requestId && (options?.enabled ?? true),
  });
}

function useInvalidateAfterCapacityReview() {
  const queryClient = useQueryClient();
  return (request: { id: string; houseId: string }) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
    queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.houses.detail(request.houseId) });
    queryClient.invalidateQueries({
      queryKey: queryKeys.houses.capacityRequests(request.houseId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.houses.capacityRequest(request.id),
    });
  };
}

export function useApproveCapacityRequest() {
  const invalidate = useInvalidateAfterCapacityReview();
  return useMutation({
    mutationFn: (requestId: string) => api.houses.approveCapacityRequest(requestId),
    onSuccess: (request) => invalidate(request),
  });
}

export function useRejectCapacityRequest() {
  const invalidate = useInvalidateAfterCapacityReview();
  return useMutation({
    mutationFn: (requestId: string) => api.houses.rejectCapacityRequest(requestId),
    onSuccess: (request) => invalidate(request),
  });
}
