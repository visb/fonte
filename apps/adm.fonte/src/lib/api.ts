import { createApiClient } from '@fonte/api-client';

export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  getToken: () => localStorage.getItem('fonte_token'),
  onUnauthorized: () => {
    localStorage.removeItem('fonte_token');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  },
});

export const TOKEN_STORAGE_KEY = 'fonte_token';
