import type { AxiosInstance } from 'axios';
import type { UserPreferences } from '../types.js';

export function createPreferencesModule(http: AxiosInstance) {
  return {
    /** Mapa chave→valor de todas as preferências do usuário logado. */
    getAll: (): Promise<UserPreferences> =>
      http.get<UserPreferences>('/preferences').then((r) => r.data),
    /** Cria/atualiza (upsert) a preferência da chave. */
    set: (key: string, value: unknown): Promise<void> =>
      http.put(`/preferences/${key}`, { value }).then(() => undefined),
    /** Remove a preferência da chave (reset ao padrão). */
    remove: (key: string): Promise<void> =>
      http.delete(`/preferences/${key}`).then(() => undefined),
  };
}
