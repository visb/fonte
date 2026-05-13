import { createApiClient } from '@fonte/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const defaultUrl =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/v1'
    : 'http://localhost:3000/api/v1';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? defaultUrl;

export const api = createApiClient({
  baseURL: apiUrl,
  getToken: () => AsyncStorage.getItem('token'),
});
