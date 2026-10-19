import { releases } from '@/lib/content';
import type { Release } from '@/lib/releases';

/** Releases ordenadas da mais nova para a mais antiga (conteúdo de build-time). */
export function useReleases(): Release[] {
  return releases;
}

export function useReleaseByVersion(version: string | undefined): Release | undefined {
  const all = useReleases();
  // Aceita /changelog/1.1.0 e /changelog/v1.1.0 (o nome da tag git).
  const wanted = version?.replace(/^v/, '');
  return all.find((release) => release.version === wanted);
}
