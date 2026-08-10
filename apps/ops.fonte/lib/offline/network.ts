import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';

/** Recorte do estado do NetInfo que decide online/offline. */
export interface NetworkStateLike {
  isConnected: boolean | null;
  isInternetReachable: boolean | null | undefined;
}

/**
 * `isInternetReachable === null` significa "ainda apurando", não "sem
 * internet": tratar o valor inicial como offline travaria o app na abertura.
 * Só o `false` explícito derruba o online.
 */
export function isStateOnline(state: NetworkStateLike): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Liga o `onlineManager` do React Query ao NetInfo. Devolve o unsubscribe.
 *
 * Sem isso o React Query em nativo assume "sempre online" e as queries falham
 * com erro de rede em vez de pausar.
 */
export function startNetworkWatcher(): () => void {
  return NetInfo.addEventListener((state) => {
    onlineManager.setOnline(isStateOnline(state));
  });
}

/**
 * Liga o `focusManager` ao `AppState`: voltar do background revalida, que é o
 * gatilho natural de "cheguei num lugar com sinal".
 *
 * No-op em web, onde o React Query já usa `visibilitychange` — o `AppState` do
 * react-native-web só duplicaria (ou brigaria com) esse comportamento.
 */
export function startFocusWatcher(): () => void {
  if (Platform.OS === 'web') return () => {};

  const subscription = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
  return () => subscription.remove();
}

/** Estado de rede para a UI (banner). Fonte única: o `onlineManager`. */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(() => onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setIsOnline), []);

  return isOnline;
}
