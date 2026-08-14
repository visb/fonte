/**
 * Carimbo da última sincronização da casa, reativo (story 175).
 *
 * Vem do `meta` do store — que guarda o `syncedAt` do **servidor** — e não do
 * `updated_at` das linhas: o operador quer saber quando o aparelho falou com o
 * backend pela última vez, não quando um campo mudou. A tela reassina o store
 * para refletir a sincronização que acontece com ela montada.
 */
import { useEffect, useState } from 'react';
import { lastSyncedAt, subscribeResidentStore } from './residentStore';

export function useLastSyncedAt(houseId: string | null | undefined): string | null {
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!houseId) {
      setSyncedAt(null);
      return;
    }

    const read = () => {
      void lastSyncedAt(houseId).then((value) => {
        if (active) setSyncedAt(value);
      });
    };

    read();
    const unsubscribe = subscribeResidentStore(read);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [houseId]);

  return syncedAt;
}
