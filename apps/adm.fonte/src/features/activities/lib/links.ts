/**
 * Normaliza a URL digitada no editor de descrição (story 72).
 *
 * Aceita esquemas seguros (`http`, `https`, `mailto`, `tel`), links relativos
 * (`/x`) e âncoras (`#x`) como estão. Entrada sem esquema ganha `https://`.
 * Qualquer esquema explícito FORA da allowlist (ex.: `javascript:`, `data:`,
 * `vbscript:`) é REJEITADO → devolve `null` (= não aplicar/remover o link),
 * fechando injeção de protocolo perigoso na origem da edição.
 *
 * Devolve `null` também para entrada vazia.
 */
export function normalizeLinkHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(value)) return value;
  // Esquema explícito não-permitido → rejeita (não vira link).
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return `https://${value}`;
}
