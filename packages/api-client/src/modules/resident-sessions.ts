import type { AxiosInstance } from 'axios';
import type { UsageSessionToday } from '../types.js';

export function createResidentSessionsModule(http: AxiosInstance) {
  return {
    getToday: (): Promise<UsageSessionToday> =>
      http.get<UsageSessionToday>('/resident-sessions/today').then((r) => r.data),
    heartbeat: (seconds: number): Promise<UsageSessionToday> =>
      http.post<UsageSessionToday>('/resident-sessions/heartbeat', { seconds }).then((r) => r.data),
    reset: (residentId: string): Promise<void> =>
      http.post(`/resident-sessions/${residentId}/reset`).then(() => undefined),
  };
}
