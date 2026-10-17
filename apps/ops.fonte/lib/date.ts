import { z } from 'zod';
import { formatIsoDateBr, isFutureDate, todayInSaoPaulo } from '@fonte/types';

// Utilitários dos campos de data digitáveis (story 209). "Hoje", futuro,
// maioridade e ordem entre datas NÃO moram aqui: vêm de `@fonte/types`
// (`todayInSaoPaulo`, `isFutureDate`, `isAdultBirthDate`, `isDateBefore`), as
// mesmas regras que o backend e o `adm` usam.

/** Tamanho do texto completo `dd/mm/aaaa`. */
export const BR_DATE_LENGTH = 10;

/**
 * Máscara `dd/mm/aaaa` sobre o que foi digitado: fica só com os dígitos (até 8)
 * e insere as barras. Colar `05/03/1985`, `05031985` ou `05-03-1985` dá o mesmo.
 */
export function maskBrDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * `dd/mm/aaaa` → `aaaa-mm-dd`, ou `null` quando o texto não forma uma data real
 * (incompleto, não numérico, `31/02/2020`, mês 13, dia 00, ano 0000).
 */
export function parseBrDate(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  // Dia 0 do mês seguinte = último dia do mês (UTC: sem efeito de fuso).
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export const DATE_FIELD_MESSAGES = {
  required: 'Informe uma data válida (dd/mm/aaaa).',
  future: 'A data não pode ser no futuro.',
} as const;

/**
 * Campo de data obrigatório de lançamento (almoxarifado, despensa, venda de
 * rua): retroativo pode, futuro não (story 209, decisão 6). Texto incompleto ou
 * inválido chega como `''` do `DateInput` e cai no `required`.
 */
export const pastOrTodayDateSchema = z
  .string()
  .min(1, DATE_FIELD_MESSAGES.required)
  .refine((v) => !isFutureDate(v, todayInSaoPaulo()), DATE_FIELD_MESSAGES.future);

/** `aaaa-mm-dd` → `dd/mm/aaaa`; vazio continua vazio. */
export function formatIsoToBr(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatIsoDateBr(iso);
}
