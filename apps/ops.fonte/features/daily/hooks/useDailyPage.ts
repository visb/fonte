import { useCallback, useMemo, useState } from 'react';
import type { DailyPerson } from '@fonte/types';
import { useIsOnline } from '@/lib/offline/network';
import { countChanges, findPersonBox, isReadOnly } from '../lib/dailyBoard';
import { useApplyDaily, useDailyBoard, useMoveDailyPerson, useStartDaily } from './useDaily';
import { useDailySocket } from './useDailySocket';

/**
 * ViewModel da tela Daily (story 225): junta query, realtime, mutations e
 * rede. A página só renderiza o que sai daqui.
 */
export function useDailyPage(houseId: string | null | undefined) {
  const house = houseId ?? '';
  const isOnline = useIsOnline();
  const boardQuery = useDailyBoard(houseId);
  const board = boardQuery.data;
  const socket = useDailySocket(houseId, board?.session.id);
  const move = useMoveDailyPerson(house);
  const apply = useApplyDaily(house);
  const start = useStartDaily(house);
  const [sheetPerson, setSheetPerson] = useState<DailyPerson | null>(null);

  const readOnly = !board || isReadOnly(board);
  const disabled = !isOnline || readOnly;
  const changes = useMemo(() => (board ? countChanges(board) : 0), [board]);

  const movePerson = useCallback(
    (person: DailyPerson, toMinistryId: string | null) => {
      setSheetPerson(null);
      if (!board || disabled) return;
      move.mutate({ sessionId: board.session.id, input: { personType: person.type, personId: person.id, toMinistryId } });
    },
    [board, disabled, move],
  );

  const openSheet = useCallback((person: DailyPerson) => {
    if (!disabled) setSheetPerson(person);
  }, [disabled]);

  const sheetCurrentBox = board && sheetPerson ? findPersonBox(board, sheetPerson.type, sheetPerson.id) : undefined;
  // Pulados só valem para o board em que o apply foi feito.
  const skipped = apply.data && board && apply.variables === board.session.id ? apply.data.skippedPeople : [];

  return {
    board,
    isLoading: boardQuery.isLoading,
    error: boardQuery.error,
    refetch: boardQuery.refetch,
    isOnline,
    readOnly,
    disabled,
    changes,
    socketError: socket.error,
    lastRemoteMove: socket.lastRemoteMove,
    sheetPerson,
    sheetCurrentBox,
    openSheet,
    closeSheet: () => setSheetPerson(null),
    movePerson,
    apply: () => board && apply.mutate(board.session.id),
    isApplying: apply.isPending,
    startNew: () => start.mutate(),
    isStarting: start.isPending,
    skipped,
  };
}
