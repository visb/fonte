/**
 * Máscara e conversão de datas do `DateInput` (story 201).
 *
 * O valor dos formulários é sempre a string `YYYY-MM-DD` (o mesmo do input
 * nativo); a exibição é `dd/mm/aaaa`. A conversão vive só aqui — schemas, DTOs e
 * api-client não mudam. Datas são montadas no fuso local (`new Date(y, m, d)`),
 * nunca por `new Date('YYYY-MM-DD')`, que é UTC e volta um dia em São Paulo.
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Aplica a máscara `dd/mm/aaaa` a qualquer texto digitado (só dígitos contam). */
export function maskDate(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Monta a data local e confere que dia/mês/ano existem (rejeita 31/02). */
function buildDate(year: number, month: number, day: number): Date | undefined {
  if (year < 1000 || month < 1 || month > 12 || day < 1) return undefined;
  const date = new Date(year, month - 1, day);
  date.setFullYear(year);
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : undefined;
}

/** `YYYY-MM-DD` → `Date` local; `undefined` se vazio ou inválido. */
export function isoToDate(iso: string | null | undefined): Date | undefined {
  const m = ISO_RE.exec(iso ?? '');
  if (!m) return undefined;
  return buildDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** `Date` → `YYYY-MM-DD` (componentes locais). */
export function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` → `dd/mm/aaaa`; `''` se vazio ou inválido. */
export function isoToDisplay(iso: string | null | undefined): string {
  const date = isoToDate(iso);
  if (!date) return '';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** `dd/mm/aaaa` → `YYYY-MM-DD`; `''` se incompleto ou inválido. */
export function displayToIso(text: string): string {
  const m = DISPLAY_RE.exec(text);
  if (!m) return '';
  const date = buildDate(Number(m[3]), Number(m[2]), Number(m[1]));
  return date ? dateToIso(date) : '';
}
