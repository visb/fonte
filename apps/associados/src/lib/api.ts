import { createApiClient } from '@fonte/api-client';

/**
 * Cliente HTTP público. Não há token JWT: o acesso é pelo `payment_token` na URL,
 * que vai no path dos endpoints públicos (/public/associates/:token).
 */
export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  getToken: () => null,
});
