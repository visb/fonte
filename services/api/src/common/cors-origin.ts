/**
 * Parses the `CORS_ORIGIN` environment variable into the list of allowed
 * origins. Extracted as a pure function because `bootstrap()` in `main.ts` is
 * not directly testable.
 *
 * The variable holds a comma-separated list (one entry per front-end host),
 * possibly with whitespace around each entry:
 *
 *   CORS_ORIGIN=https://adm.example.com, https://ops.example.com
 *
 * Returns `null` when the variable is absent, empty or made up only of
 * separators/whitespace. `null` means "no allow-list configured", and the
 * caller keeps the previous wide-open CORS behaviour — dev and the e2e suites
 * run without the variable and must not break.
 */
export function parseCorsOrigin(raw: string | undefined | null): string[] | null {
  if (!raw) return null;

  const origins: string[] = [];
  for (const entry of raw.split(",")) {
    const origin = entry.trim();
    if (origin && !origins.includes(origin)) origins.push(origin);
  }

  return origins.length > 0 ? origins : null;
}
