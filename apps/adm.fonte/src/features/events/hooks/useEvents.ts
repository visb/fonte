import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEventInput,
  ListEventsParams,
  UpdateEventInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useEvents(filters: ListEventsParams = {}) {
  return useQuery({
    queryKey: queryKeys.events.list({ filter: filters.filter }),
    queryFn: () => api.events.list(filters),
  });
}

export function useEventById(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.events.detail(id),
    queryFn: () => api.events.getById(id),
    enabled: options?.enabled ?? true,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEventInput) => api.events.create(data),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEventInput }) =>
      api.events.update(id, data),
    onSuccess: (_data, { id }) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id) });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.events.remove(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUploadEventBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new window.FormData();
      fd.append('file', file);
      return api.events.uploadBanner(id, fd);
    },
    onSuccess: (_data, { id }) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id) });
    },
  });
}
