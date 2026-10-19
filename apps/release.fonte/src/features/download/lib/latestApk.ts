// Manifesto do último APK publicado (/downloads/latest.json), gerado pelo
// release.yml junto com o APK. A página só anuncia o que este arquivo descreve:
// é ele — e não o markdown do changelog — que garante que o APK existe.

export interface LatestApk {
  version: string;
  versionCode: number;
  sizeBytes: number;
  sha256: string;
  builtAt: string;
}

export const LATEST_APK_URL = '/downloads/latest.json';
export const APK_URL = '/downloads/ops.apk';

export function versionedApkUrl(version: string): string {
  return `/downloads/ops-${version}.apk`;
}

function isLatestApk(value: unknown): value is LatestApk {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === 'string' &&
    typeof candidate.versionCode === 'number' &&
    typeof candidate.sizeBytes === 'number' &&
    typeof candidate.sha256 === 'string' &&
    typeof candidate.builtAt === 'string'
  );
}

/**
 * `null` = APK ainda não publicado (bootstrap): 404, ou uma resposta que nem é
 * JSON (fallback de SPA devolvendo o index.html). Manifesto existente mas
 * malformado é bug de publicação e vira erro — nunca um botão quebrado.
 */
export async function fetchLatestApk(fetcher: typeof fetch = fetch): Promise<LatestApk | null> {
  const response = await fetcher(LATEST_APK_URL, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Falha ao consultar o APK (HTTP ${response.status})`);

  let body: unknown;
  try {
    body = JSON.parse(await response.text());
  } catch {
    return null;
  }
  if (!isLatestApk(body)) throw new Error('Manifesto do APK (latest.json) malformado');
  return body;
}
