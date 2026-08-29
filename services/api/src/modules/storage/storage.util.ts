// Pure, dependency-free helpers for the bucket orphan-cleanup feature (story 93).
// Kept isolated from StorageService so they can be unit-tested without S3/config.

// Matches the `src="..."`/`src='...'` of an <img> tag. The non-greedy `[^>]*?`
// keeps the match inside a single tag and the quote backref (\2) bounds the URL,
// so other attributes/tags are never touched. Shared with StorageService so the
// extraction and the sign/strip passes agree on what an image URL is.
export const IMG_SRC_RE = /(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi;

/**
 * Extracts the canonical <img src> URLs of an HTML blob that belong to our
 * bucket. Strips any presign query (?X-Amz-...) so the result matches the
 * persisted canonical URL. `data:`/base64 and external URLs are ignored — only
 * URLs under `bucketBaseUrl` are returned, de-duplicated. Pure: no I/O.
 */
export function extractImageUrls(html: string, bucketBaseUrl: string | null): string[] {
  if (!html || !bucketBaseUrl) return [];
  const prefix = `${bucketBaseUrl}/`;
  const out = new Set<string>();
  for (const match of html.matchAll(IMG_SRC_RE)) {
    const src = match[3];
    const qIdx = src.indexOf('?');
    const base = qIdx >= 0 ? src.slice(0, qIdx) : src;
    if (base.startsWith(prefix)) out.add(base);
  }
  return [...out];
}

/**
 * Moves a persisted storage URL from one bucket base to another, keeping the
 * object key (story 188 — Railway → self-hosted MinIO). Since `upload()` stores
 * `${publicBaseUrl}/${key}` and the migration re-uploads under the same key,
 * rebasing is a prefix swap.
 *
 * Anything not under `fromBase` is returned untouched: URLs already on
 * `toBase` (so the rewrite is idempotent), external CDNs, `data:` blobs and
 * local `/uploads/...` paths. Any presign query is stripped, recovering the
 * canonical URL. Pure: no I/O.
 */
export function rebaseStorageUrl(
  url: string | null | undefined,
  fromBase: string,
  toBase: string,
): string | null | undefined {
  if (!url) return url;
  const prefix = `${fromBase}/`;
  const qIdx = url.indexOf('?');
  const base = qIdx >= 0 ? url.slice(0, qIdx) : url;
  if (!base.startsWith(prefix)) return url;
  return `${toBase}/${base.slice(prefix.length)}`;
}

/**
 * Rebases every `<img src>` of an HTML blob that points at `fromBase`
 * (story 188). Uses {@link IMG_SRC_RE} so it only ever touches the `src`
 * attribute of an `<img>` — a plain string replace would also rewrite the base
 * url wherever it appears as body text. Pure: no I/O.
 */
export function rebaseHtmlStorageUrls(
  html: string | null | undefined,
  fromBase: string,
  toBase: string,
): string | null | undefined {
  if (!html) return html;
  return html.replace(
    IMG_SRC_RE,
    (_match, pre: string, quote: string, src: string) =>
      `${pre}${quote}${rebaseStorageUrl(src, fromBase, toBase)}${quote}`,
  );
}

/**
 * Orphans = bucket objects not referenced by any record. Pure set difference,
 * order-preserving over `bucketKeys`. Extracted for isolated unit testing of the
 * reconcile math.
 */
export function computeOrphans(
  bucketKeys: string[],
  referencedKeys: ReadonlySet<string>,
): string[] {
  return bucketKeys.filter((key) => !referencedKeys.has(key));
}
