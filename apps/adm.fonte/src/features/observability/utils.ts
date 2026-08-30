import type { ObservabilityRouteStats } from '@fonte/api-client';
import {
  ERROR_STATUS_THRESHOLD,
  N_PLUS_ONE_QUERIES_THRESHOLD,
  SLOW_P95_MS_THRESHOLD,
  type RouteSortKey,
} from './constants';

/**
 * Formatação e ordenação da tela de observabilidade (story 192).
 *
 * O backend pode devolver rota sem amostra de DB (`avgDbMs` ausente); nenhum
 * formatador aqui pode transformar isso em `NaN` na tela — ausência vira o
 * placeholder `—`.
 */

export const EMPTY_VALUE = '—';

function isNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Milissegundos com uma casa: `12.3 ms`. */
export function formatMs(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY_VALUE;
  return `${value.toFixed(1)} ms`;
}

/** Megabytes com uma casa (o contrato da story 191 já entrega MB). */
export function formatMb(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY_VALUE;
  return `${value.toFixed(1)} MB`;
}

/** Percentual com uma casa: `42.0%`. */
export function formatPercent(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY_VALUE;
  return `${value.toFixed(1)}%`;
}

/** Número simples (médias de queries, contagens) com casas configuráveis. */
export function formatNumber(
  value: number | null | undefined,
  digits = 1,
): string {
  if (!isNumber(value)) return EMPTY_VALUE;
  return value.toFixed(digits);
}

/** Kilobytes com sinal — delta de heap pode ser negativo (GC no meio). */
export function formatKb(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY_VALUE;
  return `${Math.round(value)} kB`;
}

/** Uptime humanizado: `2d 3h`, `3h 14min`, `47s`. */
export function formatUptime(seconds: number | null | undefined): string {
  if (!isNumber(seconds) || seconds < 0) return EMPTY_VALUE;
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min ${secs}s`;
  return `${secs}s`;
}

/** `HH:MM:SS` local — o ring buffer é do minuto corrente, a data não ajuda. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return date.toLocaleTimeString('pt-BR');
}

/** `dd/mm/aaaa HH:MM:SS` — usado no "agregado desde". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return date.toLocaleString('pt-BR');
}

/** Média de queries acima do corte: cheiro de N+1. */
export function isNPlusOneSuspect(route: ObservabilityRouteStats): boolean {
  return (
    isNumber(route.avgDbQueries) &&
    route.avgDbQueries > N_PLUS_ONE_QUERIES_THRESHOLD
  );
}

/** p95 acima do corte: lentidão perceptível. */
export function isSlowRoute(route: ObservabilityRouteStats): boolean {
  return (
    isNumber(route.p95DurationMs) && route.p95DurationMs > SLOW_P95_MS_THRESHOLD
  );
}

export function isErrorStatus(status: number | null | undefined): boolean {
  return isNumber(status) && status >= ERROR_STATUS_THRESHOLD;
}

/**
 * Ordena por uma das três lentes de custo. Ausência de valor vai para o fim
 * (tratada como 0) e empate mantém a ordem de entrada — `Array.sort` é estável.
 */
export function sortRoutes(
  routes: ObservabilityRouteStats[],
  key: RouteSortKey,
  direction: 'asc' | 'desc',
): ObservabilityRouteStats[] {
  const factor = direction === 'desc' ? -1 : 1;
  return [...routes].sort((a, b) => {
    const av = isNumber(a[key]) ? a[key] : 0;
    const bv = isNumber(b[key]) ? b[key] : 0;
    if (av === bv) return 0;
    return av < bv ? -1 * factor : 1 * factor;
  });
}
