/**
 * Máscara de WhatsApp BR (story 46). O valor de verdade continua E.164
 * (`+5562999998888`); estas funções só cuidam da exibição/digitação.
 * Assume Brasil (+55) — cadastro é da comunidade local.
 */

/** Extrai apenas os dígitos de uma string. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Normaliza dígitos para o nacional (sem o 55): se vier com o DDI 55 e tiver
 * comprimento de número BR completo, remove o prefixo 55.
 */
function nationalDigits(raw: string): string {
  let d = digitsOnly(raw);
  if (d.startsWith('55') && d.length > 11) {
    d = d.slice(2);
  }
  return d.slice(0, 11); // DDD (2) + número (até 9)
}

/**
 * Formata um valor (E.164 ou dígitos parciais durante a digitação) como
 * `+55 (62) 99999-8888`. Tolerante a entradas incompletas.
 */
export function formatWhatsapp(value: string): string {
  const d = nationalDigits(value);
  if (d.length === 0) return '';

  const ddd = d.slice(0, 2);
  const rest = d.slice(2);

  let out = '+55';
  out += ` (${ddd}`;
  if (d.length < 2) return out; // ainda digitando o DDD
  out += ')';
  if (rest.length === 0) return out;

  // Número: parte antes do hífen tem 5 díg (celular 9) ou 4 (fixo 8).
  const breakAt = rest.length > 8 ? 5 : 4;
  const first = rest.slice(0, breakAt);
  const last = rest.slice(breakAt);
  out += ` ${first}`;
  if (last.length > 0) out += `-${last}`;
  return out;
}

/** Converte um valor mascarado/digitado para E.164 (`+55XXXXXXXXXXX`). */
export function toE164(masked: string): string {
  const d = nationalDigits(masked);
  if (d.length === 0) return '';
  return `+55${d}`;
}
