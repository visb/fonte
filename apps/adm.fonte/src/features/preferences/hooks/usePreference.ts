import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { readPreference, writePreferenceCache } from '@/lib/preferences';

/** Espera antes de persistir no banco — agrupa mudanças rápidas (decisão 7). */
const PERSIST_DEBOUNCE_MS = 500;

/**
 * Lê/grava uma preferência do usuário (story 130). O valor inicial vem do cache
 * síncrono (`localStorage`) no primeiro render — sem piscar o padrão. `setValue`
 * grava no cache na hora e persiste no banco com debounce (os dois lados da
 * decisão 7). Erro ao persistir não interrompe a tela: preferência é conveniência.
 */
export function usePreference<T>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValueState] = useState<T>(() => readPreference(key, defaultValue));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      writePreferenceCache(key, next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        api.preferences.set(key, next).catch(() => {
          // Persistência é best-effort; o cache local já reflete a escolha.
        });
      }, PERSIST_DEBOUNCE_MS);
    },
    [key],
  );

  return [value, setValue];
}
