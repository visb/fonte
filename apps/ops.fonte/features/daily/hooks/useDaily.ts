import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApplyDailyResult, DailyBoard, MoveDailyPersonInput } from '@fonte/types';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/queryKeys';
import { applyMove, describeSkipped, withVersion } from '../lib/dailyBoard';
import { DAILY_LABELS } from '../constants';

/**
 * Story 225 — ViewModel do board da daily. A daily EXIGE rede (decisão 11):
 * as mutations não têm `mutationKey` de outbox nem `offlineFirst` — sem sinal a
 * tela desabilita as ações. A query não entra na allowlist de persistência.
 */
export function useDailyBoard(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.daily.board(houseId ?? ''),
    queryFn: () => api.daily.current(houseId),
    enabled: !!houseId,
    // Realtime mantém o board fresco; refetch em reconexão (decisão 11: ao
    // voltar a rede, GET completo), salto de version e volta do background.
    staleTime: Infinity,
    refetchOnReconnect: 'always',
  });
}

interface MoveVariables {
  sessionId: string;
  input: MoveDailyPersonInput;
}

/** Movimento otimista (setQueryData) + rollback com aviso no erro. */
export function useMoveDailyPerson(houseId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.daily.board(houseId);
  return useMutation({
    mutationFn: ({ sessionId, input }: MoveVariables) => api.daily.move(sessionId, input),
    onMutate: async ({ input }: MoveVariables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DailyBoard>(key);
      if (previous) queryClient.setQueryData<DailyBoard>(key, applyMove(previous, input));
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      Alert.alert('Erro', getErrorMessage(error, DAILY_LABELS.moveError));
      // 409 (encerrada) / 400 (board velho): o estado do servidor manda.
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onSuccess: ({ version }) => {
      queryClient.setQueryData<DailyBoard>(key, (board) => (board ? withVersion(board, version) : board));
    },
  });
}

export type ApplyDailyOutcome = ApplyDailyResult & {
  skippedPeople: ReturnType<typeof describeSkipped>;
};

/** "Aplicar": grava nos ministérios reais; ministérios/servos da casa ficam velhos. */
export function useApplyDaily(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation<ApplyDailyOutcome, unknown, string>({
    mutationFn: async (sessionId: string) => {
      const before = queryClient.getQueryData<DailyBoard>(queryKeys.daily.board(houseId));
      const result = await api.daily.apply(sessionId);
      return { ...result, skippedPeople: describeSkipped(before, result.skipped) };
    },
    onError: (error) => {
      Alert.alert('Erro', getErrorMessage(error, DAILY_LABELS.applyError));
      void queryClient.invalidateQueries({ queryKey: queryKeys.daily.board(houseId) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.daily.board(houseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.ministries.details });
      void queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff.byHouse(houseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.residents.byHouse(houseId) });
    },
  });
}

/** "Nova daily" depois de aplicar: o board novo entra direto no cache. */
export function useStartDaily(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.daily.start(houseId),
    onError: (error) => Alert.alert('Erro', getErrorMessage(error, DAILY_LABELS.startError)),
    onSuccess: (board: DailyBoard) => {
      queryClient.setQueryData(queryKeys.daily.board(houseId), board);
    },
  });
}
