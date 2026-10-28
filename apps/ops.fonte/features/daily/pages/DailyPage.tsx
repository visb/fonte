import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useDailyPage } from '../hooks/useDailyPage';
import { DAILY_LABELS } from '../constants';
import { DailyBoard } from '../components/DailyBoard';
import { DailyApplyBar } from '../components/DailyApplyBar';
import { DailyOfflineBanner } from '../components/DailyOfflineBanner';
import { MoveToSheet } from '../components/MoveToSheet';

const HEADER = {
  title: DAILY_LABELS.title,
  headerStyle: { backgroundColor: '#272950' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' as const },
};

/** Story 225 — tela Daily: orquestra o ViewModel e os componentes do board. */
export function DailyPage() {
  const { staff } = useAuth();
  const vm = useDailyPage(staff?.houseId);

  let body;
  if (vm.isLoading) body = <LoadingState />;
  else if (!vm.board) {
    body = <ErrorState message={getErrorMessage(vm.error, DAILY_LABELS.loadError)} onRetry={() => void vm.refetch()} />;
  } else if (vm.board.ministries.length === 0 && vm.board.unassigned.length === 0) {
    body = <EmptyState message={DAILY_LABELS.empty} />;
  } else {
    body = (
      <>
        <DailyBoard
          board={vm.board}
          disabled={vm.disabled}
          onMove={vm.movePerson}
          onPressPerson={vm.openSheet}
          lastRemoteMove={vm.lastRemoteMove}
        />
        <DailyApplyBar
          session={vm.board.session}
          changes={vm.changes}
          isOnline={vm.isOnline}
          isApplying={vm.isApplying}
          isStarting={vm.isStarting}
          skipped={vm.skipped}
          onApply={vm.apply}
          onStartNew={vm.startNew}
        />
        <MoveToSheet
          person={vm.sheetPerson}
          ministries={vm.board.ministries}
          currentMinistryId={vm.sheetCurrentBox}
          onSelect={vm.movePerson}
          onClose={vm.closeSheet}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={HEADER} />
      <View testID="daily-page" className="flex-1 bg-white">
        <View className="px-4 pt-3 gap-2">
          <DailyOfflineBanner visible={!vm.isOnline} />
          {vm.socketError ? (
            <Text testID="daily-socket-error" className="text-xs text-red-600">{vm.socketError}</Text>
          ) : null}
          {vm.board && vm.readOnly ? (
            <Text className="text-xs text-gray-500">{DAILY_LABELS.readOnlyApplied}</Text>
          ) : null}
        </View>
        {body}
      </View>
    </>
  );
}
