import type { AxiosInstance } from 'axios';
import type {
  ObservabilityHealth,
  ObservabilityResetResponse,
  ObservabilityStats,
} from '../types.js';

/**
 * Observabilidade da API (story 191). `health` é público; `stats` e `reset`
 * exigem ADMIN. A tela que consome isso é a story 192.
 */
export function createObservabilityModule(http: AxiosInstance) {
  return {
    health: () =>
      http.get<ObservabilityHealth>('/observability/health').then((r) => r.data),
    stats: () => http.get<ObservabilityStats>('/observability/stats').then((r) => r.data),
    reset: () =>
      http.post<ObservabilityResetResponse>('/observability/reset').then((r) => r.data),
  };
}
