import { createApiClient } from '@fonte/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const defaultUrl =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/v1'
    : 'http://localhost:3000/api/v1';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? defaultUrl;

export const apiOrigin = apiUrl.replace(/\/api\/v\d+\/?$/, '');

export const api = createApiClient({
  baseURL: apiUrl,
  getToken: () => AsyncStorage.getItem('token'),
});

export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${apiOrigin}${url}`;
}
