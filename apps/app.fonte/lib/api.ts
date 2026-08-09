import { createApiClient, type UnauthorizedContext } from '@fonte/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const defaultUrl =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/v1'
    : 'http://localhost:3000/api/v1';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? defaultUrl;

export type UnauthorizedHandler = (context: UnauthorizedContext) => void;

/**
 * Ponte entre o client HTTP (módulo, criado fora da árvore React) e o AuthProvider.
 * O provider registra o handler no mount; até lá o 401 é apenas ignorado aqui e
 * segue rejeitando a chamada normalmente.
 */
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export const api = createApiClient({
  baseURL: apiUrl,
  getToken: () => AsyncStorage.getItem('token'),
  onUnauthorized: (context) => {
    unauthorizedHandler?.(context);
  },
});
