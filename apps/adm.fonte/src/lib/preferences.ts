import type { UserPreferences } from '@fonte/api-client';

/**
 * Cache local das preferências do usuário (story 130). O banco é a fonte; o
 * `localStorage` é só um cache lido de forma síncrona no primeiro render, para
 * a tela não piscar o padrão antes da rede responder (decisão 8). Populado no
 * login (a partir do `getAll` do servidor) e limpo no logout (decisão 9).
 */
const PREFERENCES_STORAGE_KEY = 'fonte.preferences';

/** Mapa chave→valor completo do cache. Nunca quebra a tela: corrompido → {}. */
export function readPreferences(): UserPreferences {
  const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // Só objeto simples é um mapa de preferências válido.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as UserPreferences;
    }
    return {};
  } catch {
    return {};
  }
}

/** Valor de uma chave do cache, ou o default quando ausente/corrompido. */
export function readPreference<T>(key: string, defaultValue: T): T {
  const all = readPreferences();
  return key in all ? (all[key] as T) : defaultValue;
}

/** Substitui o cache inteiro (usado no login com o mapa vindo do servidor). */
export function writePreferences(map: UserPreferences): void {
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(map));
}

/** Grava uma única chave no cache, preservando as demais. */
export function writePreferenceCache(key: string, value: unknown): void {
  const all = readPreferences();
  all[key] = value;
  writePreferences(all);
}

/** Zera o cache (logout). */
export function clearPreferences(): void {
  localStorage.removeItem(PREFERENCES_STORAGE_KEY);
}
