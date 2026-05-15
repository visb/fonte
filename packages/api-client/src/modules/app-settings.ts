import type { AxiosInstance } from 'axios';
import type { AppSettings, UpdateAppSettingsInput } from '../types.js';

export function createAppSettingsModule(http: AxiosInstance) {
  return {
    get: (): Promise<AppSettings> =>
      http.get<AppSettings>('/app-settings').then((r) => r.data),
    update: (data: UpdateAppSettingsInput): Promise<AppSettings> =>
      http.patch<AppSettings>('/app-settings', data).then((r) => r.data),
  };
}
