const mockAddEventListener = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
  },
}));

import { act, renderHook } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';
import {
  isStateOnline,
  startFocusWatcher,
  startNetworkWatcher,
  useIsOnline,
  type NetworkStateLike,
} from './network';

/** Estado do NetInfo com os campos que a decisão de online/offline usa. */
function netState(state: Partial<NetworkStateLike>): NetworkStateLike {
  return { isConnected: null, isInternetReachable: null, ...state };
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // O onlineManager é global: teste que derruba a rede não pode vazar.
  onlineManager.setOnline(true);
});

describe('isStateOnline', () => {
  it('conectado e alcançável = online', () => {
    expect(isStateOnline(netState({ isConnected: true, isInternetReachable: true }))).toBe(true);
  });

  it('sem conexão = offline', () => {
    expect(isStateOnline(netState({ isConnected: false }))).toBe(false);
    expect(isStateOnline(netState({ isConnected: false, isInternetReachable: true }))).toBe(false);
  });

  it('alcançabilidade indeterminada (null) NÃO vira offline', () => {
    // O NetInfo entrega null enquanto ainda está apurando; tratar isso como
    // offline travaria o app inteiro na abertura.
    expect(isStateOnline(netState({ isConnected: true, isInternetReachable: null }))).toBe(true);
    expect(isStateOnline(netState({ isConnected: true, isInternetReachable: undefined }))).toBe(true);
  });

  it('alcançabilidade false explícita vira offline', () => {
    expect(isStateOnline(netState({ isConnected: true, isInternetReachable: false }))).toBe(false);
  });

  it('isConnected null (ainda desconhecido) não é considerado online', () => {
    expect(isStateOnline(netState({ isConnected: null, isInternetReachable: true }))).toBe(false);
  });
});

describe('startNetworkWatcher', () => {
  function listen() {
    const unsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribe);
    const stop = startNetworkWatcher();
    const listener = mockAddEventListener.mock.calls[0][0] as (s: NetworkStateLike) => void;
    return { listener, stop, unsubscribe };
  }

  it('alimenta o onlineManager com o estado do NetInfo', () => {
    const setOnline = jest.spyOn(onlineManager, 'setOnline');
    const { listener, stop } = listen();

    listener(netState({ isConnected: true, isInternetReachable: true }));
    expect(setOnline).toHaveBeenLastCalledWith(true);

    listener(netState({ isConnected: false, isInternetReachable: false }));
    expect(setOnline).toHaveBeenLastCalledWith(false);

    listener(netState({ isConnected: true, isInternetReachable: null }));
    expect(setOnline).toHaveBeenLastCalledWith(true);

    stop();
    setOnline.mockRestore();
  });

  it('devolve o unsubscribe do NetInfo', () => {
    const { stop, unsubscribe } = listen();

    expect(unsubscribe).not.toHaveBeenCalled();
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('startFocusWatcher', () => {
  it('em nativo, liga o focusManager ao AppState e remove a assinatura no cleanup', () => {
    const remove = jest.fn();
    const addEventListener = jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<typeof AppState.addEventListener>);
    const setFocused = jest.spyOn(focusManager, 'setFocused');

    const stop = startFocusWatcher();
    const listener = addEventListener.mock.calls[0][1] as (s: string) => void;

    listener('active');
    expect(setFocused).toHaveBeenLastCalledWith(true);
    listener('background');
    expect(setFocused).toHaveBeenLastCalledWith(false);

    stop();
    expect(remove).toHaveBeenCalledTimes(1);

    addEventListener.mockRestore();
    setFocused.mockRestore();
    focusManager.setFocused(undefined);
  });

  it('em web é no-op (o React Query já usa visibilitychange)', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const addEventListener = jest.spyOn(AppState, 'addEventListener');

    const stop = startFocusWatcher();

    expect(addEventListener).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();

    addEventListener.mockRestore();
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });
});

describe('useIsOnline', () => {
  it('reflete o onlineManager e reage às mudanças', () => {
    const { result } = renderHook(() => useIsOnline());
    expect(result.current).toBe(true);

    act(() => onlineManager.setOnline(false));
    expect(result.current).toBe(false);

    act(() => onlineManager.setOnline(true));
    expect(result.current).toBe(true);
  });

  it('desassina no unmount (não vaza listener)', () => {
    const { result, unmount } = renderHook(() => useIsOnline());
    unmount();

    act(() => onlineManager.setOnline(false));
    expect(result.current).toBe(true);
  });
});
