import type { Request } from 'express';

/**
 * Normalização de rota (story 191).
 *
 * Cardinalidade é o modo de falha clássico deste tipo de coletor: guardar
 * `/residents/<uuid>` como chave distinta transforma o `Map` do MetricsStore em
 * vazamento de memória. Aqui todo identificador vira `:id`.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC = /^\d+$/;
/** Hash hex (token, sha, id opaco). ≥ 12 chars para não pegar palavra tipo `abc`. */
const HEX = /^[0-9a-f]{12,}$/i;

/** Segmento que carrega identificador vira `:id`; texto de recurso é preservado. */
function normalizeSegment(segment: string): string {
  if (UUID.test(segment) || NUMERIC.test(segment) || HEX.test(segment)) return ':id';
  return segment;
}

/** Normaliza um path cru (sem query string) trocando identificadores por `:id`. */
export function normalizePath(rawPath: string): string {
  const [withoutQuery] = rawPath.split('?');
  const segments = withoutQuery.split('/').filter(Boolean).map(normalizeSegment);
  return segments.length ? `/${segments.join('/')}` : '/';
}

type RouteAwareRequest = Pick<Request, 'method'> & {
  baseUrl?: string;
  originalUrl?: string;
  path?: string;
  url?: string;
  route?: { path?: string } | null;
};

/**
 * Path da requisição já normalizado.
 *
 * Preferimos o PADRÃO da rota do Express (`req.baseUrl + req.route.path`), que
 * só existe depois do roteador — é o caminho feliz e o mais preciso
 * (`/api/v1/residents/:id`). Sem `req.route` (404, arquivo estático, requisição
 * barrada antes do roteador) caímos no `req.path` normalizado por heurística.
 */
export function routePathOf(req: RouteAwareRequest): string {
  const routePath = req.route?.path;
  if (routePath) {
    const base = req.baseUrl ?? '';
    const joined = `${base}${routePath}`;
    // `req.route.path` pode ser '/' em rota raiz montada num prefixo.
    const merged = joined.replace(/\/+$/, '') || '/';
    return merged.startsWith('/') ? merged : `/${merged}`;
  }
  const raw = req.path ?? req.originalUrl ?? req.url ?? '/';
  return normalizePath(raw);
}

/** Chave do agregado: `` `${method} ${path}` `` (ex.: `GET /api/v1/residents/:id`). */
export function routeNameOf(req: RouteAwareRequest): string {
  return `${(req.method ?? 'GET').toUpperCase()} ${routePathOf(req)}`;
}
