import type { AxiosInstance } from 'axios';
import type { HouseOfflineSnapshotResponse } from '../types.js';

export function createOfflineSyncModule(http: AxiosInstance) {
  return {
    /**
     * Pacote offline da casa (story 177) — um request no lugar do fan-out de
     * `1 + N×4`.
     *
     * `since` é o `syncedAt` da sincronização anterior (relógio do **servidor**,
     * nunca o do aparelho): omiti-lo, ou mandar um mais velho que 30 dias, pede
     * sincronização completa e a resposta volta com `full: true`.
     */
    houseSnapshot: (houseId: string, since?: string): Promise<HouseOfflineSnapshotResponse> =>
      http
        .get<HouseOfflineSnapshotResponse>(
          `/houses/${houseId}/offline-snapshot`,
          since ? { params: { since } } : undefined,
        )
        .then((r) => r.data),
  };
}
