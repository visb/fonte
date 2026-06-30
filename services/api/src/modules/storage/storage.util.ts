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
