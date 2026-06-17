import type { Event } from '@fonte/api-client';

export interface ClassifiedEvents {
  /** Os 3 eventos futuros mais próximos (por start_at), destacados na timeline. */
  highlightedIds: Set<string>;
  /** Eventos com start_at no passado (start_at < now), exibidos opacos. */
  pastIds: Set<string>;
}

/** Quantos eventos futuros recebem destaque visual. */
export const HIGHLIGHT_COUNT = 3;

/**
 * Classifica os eventos para a timeline (função pura, testável).
 * Estável: em empate de start_at, os que vêm primeiro na lista de entrada
 * ocupam as vagas de destaque.
 */
export function classifyEvents(events: Event[], now: Date): ClassifiedEvents {
  const nowMs = now.getTime();
  const pastIds = new Set<string>();
  const future: { id: string; t: number; index: number }[] = [];

  events.forEach((e, index) => {
    const t = new Date(e.startAt).getTime();
    if (t < nowMs) {
      pastIds.add(e.id);
    } else {
      future.push({ id: e.id, t, index });
    }
  });

  // Ordena por data; empate resolve pela ordem original (estável).
  future.sort((a, b) => a.t - b.t || a.index - b.index);

  const highlightedIds = new Set(
    future.slice(0, HIGHLIGHT_COUNT).map((f) => f.id),
  );

  return { highlightedIds, pastIds };
}
