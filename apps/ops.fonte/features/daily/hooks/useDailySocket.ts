import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  DAILY_SOCKET_EVENTS,
  DAILY_SOCKET_NAMESPACE,
  type DailyAppliedEvent,
  type DailyBoard,
  type DailyErrorEvent,
  type DailyMovedEvent,
} from '@fonte/types';
import { useAuth } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';
import { createRealtimeSocket, readSocketToken } from '@/lib/realtime';
import { applyMove, hasVersionGap, isStaleEvent, markApplied } from '../lib/dailyBoard';

/**
 * Story 225 (decisões 7 e 10) — canal realtime do board. Entra na room da
 * sessão (`daily:join`) e mantém o cache do board em dia:
 * - `daily:moved` aplica o movimento no cache; salto de `version` → GET completo;
 * - reconexão / volta do background → GET completo (podemos ter perdido eventos);
 * - `daily:applied` → board somente leitura; `daily:reset` → GET (sessão nova);
 * - `daily:error` → aviso na tela.
 * Devolve o último movimento remoto (para cancelar o arrasto local da mesma pessoa).
 */
export function useDailySocket(houseId: string | null | undefined, sessionId: string | null | undefined) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [lastRemoteMove, setLastRemoteMove] = useState<DailyMovedEvent | null>(null);

  useEffect(() => {
    if (!token || !houseId || !sessionId) return;
    const key = queryKeys.daily.board(houseId);
    const refetch = () => void queryClient.invalidateQueries({ queryKey: key });
    let cancelled = false;
    let socket: ReturnType<typeof createRealtimeSocket> | null = null;
    let connectedOnce = false;

    const onConnect = () => {
      setError(null);
      socket?.emit(DAILY_SOCKET_EVENTS.JOIN, { sessionId });
      if (connectedOnce) refetch();
      connectedOnce = true;
    };

    const onMoved = (event: DailyMovedEvent) => {
      let gap = false;
      queryClient.setQueryData<DailyBoard>(key, (board) => {
        if (!board || board.session.id !== event.sessionId) return board;
        if (isStaleEvent(board.session.version, event.version)) return board;
        if (hasVersionGap(board.session.version, event.version)) {
          gap = true;
          return board;
        }
        const moved = applyMove(board, event);
        return { ...moved, session: { ...moved.session, version: event.version } };
      });
      setLastRemoteMove(event);
      if (gap) refetch();
    };

    const onApplied = (event: DailyAppliedEvent) => {
      queryClient.setQueryData<DailyBoard>(key, (board) => (board ? markApplied(board, event) : board));
    };

    const onError = (event: DailyErrorEvent) => setError(event?.message ?? 'Erro na daily.');

    void readSocketToken(token).then((authToken) => {
      if (cancelled) return;
      socket = createRealtimeSocket(DAILY_SOCKET_NAMESPACE, authToken);
      socket.on('connect', onConnect);
      socket.on(DAILY_SOCKET_EVENTS.MOVED, onMoved);
      socket.on(DAILY_SOCKET_EVENTS.APPLIED, onApplied);
      socket.on(DAILY_SOCKET_EVENTS.RESET, refetch);
      socket.on(DAILY_SOCKET_EVENTS.ERROR, onError);
    });

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (socket && !socket.connected) socket.connect();
      refetch();
    });

    return () => {
      cancelled = true;
      sub.remove();
      if (socket) {
        socket.off();
        socket.disconnect();
      }
    };
  }, [token, houseId, sessionId, queryClient]);

  return { error, lastRemoteMove };
}
