import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createWebDriver } from './driver.asyncStorage';
import { setResidentStoreDriver } from './driver';
import { setLastSyncedAt } from './residentStore';
import { useLastSyncedAt } from './useLastSyncedAt';

beforeEach(async () => {
  await AsyncStorage.clear();
  setResidentStoreDriver(createWebDriver());
});

afterEach(() => setResidentStoreDriver(null));

describe('useLastSyncedAt', () => {
  it('lê o carimbo guardado da casa', async () => {
    await setLastSyncedAt('h1', '2026-08-14T12:00:00.000Z');

    const { result } = renderHook(() => useLastSyncedAt('h1'));

    await waitFor(() => expect(result.current).toBe('2026-08-14T12:00:00.000Z'));
  });

  it('reflete a sincronização que acontece com a tela montada', async () => {
    const { result } = renderHook(() => useLastSyncedAt('h1'));
    await waitFor(() => expect(result.current).toBeNull());

    await setLastSyncedAt('h1', '2026-08-14T12:00:00.000Z');

    await waitFor(() => expect(result.current).toBe('2026-08-14T12:00:00.000Z'));
  });

  it('sem casa não lê nada', async () => {
    await setLastSyncedAt('h1', '2026-08-14T12:00:00.000Z');

    const { result } = renderHook(() => useLastSyncedAt(null));

    await waitFor(() => expect(result.current).toBeNull());
  });

  it('para de ouvir o store depois de desmontar', async () => {
    const { result, unmount } = renderHook(() => useLastSyncedAt('h1'));
    await waitFor(() => expect(result.current).toBeNull());

    unmount();
    await setLastSyncedAt('h1', '2026-08-14T12:00:00.000Z');

    expect(result.current).toBeNull();
  });
});
