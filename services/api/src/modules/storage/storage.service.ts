import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { extname, join } from "path";

// Signed URLs are valid for 24h, but we serve a cached one for only 12h so a
// URL handed to the client always has >=12h of validity left.
const SIGN_EXPIRES_IN = 86400;
const CACHE_REUSE_MS = 12 * 60 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 5000;

interface SignedUrlCacheEntry {
  signedUrl: string;
  expiresAt: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private s3: S3Client | null = null;
  private bucketName: string | null = null;
  private publicBaseUrl: string | null = null;

  // Keyed by the unsigned S3 URL (deterministic per object). Bounds memory via
  // an LRU cap (Map keeps insertion order) plus lazy + scheduled expiry.
  private urlCache = new Map<string, SignedUrlCacheEntry>();
  private cacheMaxEntries: number;

  constructor(private config: ConfigService) {
    this.cacheMaxEntries =
      config.get<number>("SIGNED_URL_CACHE_MAX") ?? DEFAULT_CACHE_MAX_ENTRIES;

    const bucketName = config.get<string>("AWS_S3_BUCKET_NAME");
    const endpoint = config.get<string>("AWS_ENDPOINT_URL");

    if (bucketName && endpoint) {
      this.bucketName = bucketName;
      this.publicBaseUrl = `${endpoint}/${bucketName}`;
      this.s3 = new S3Client({
        endpoint,
        region: config.get<string>("AWS_DEFAULT_REGION") ?? "auto",
        credentials: {
          accessKeyId: config.get<string>("AWS_ACCESS_KEY_ID") ?? "",
          secretAccessKey: config.get<string>("AWS_SECRET_ACCESS_KEY") ?? "",
        },
        forcePathStyle: true,
      });
    }
  }

  async onModuleInit() {
    if (!this.s3) {
      await Promise.all([
        mkdir(join(process.cwd(), "uploads", "residents"), { recursive: true }),
        mkdir(join(process.cwd(), "uploads", "documents"), { recursive: true }),
        mkdir(join(process.cwd(), "uploads", "attachments"), {
          recursive: true,
        }),
        mkdir(join(process.cwd(), "uploads", "houses"), { recursive: true }),
      ]);
    }
  }

  /**
   * Multer/busboy decodes the multipart filename as latin1, which mangles
   * UTF-8 accents (e.g. "João" arrives as "JoÃ£o"). Re-decode to utf8.
   */
  decodeOriginalName(originalname: string): string {
    return Buffer.from(originalname, "latin1").toString("utf8");
  }

  uniqueFilename(originalname: string, prefix = ""): string {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    return `${prefix}${suffix}${extname(originalname)}`;
  }

  async upload(
    folder: string,
    filename: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    if (this.s3 && this.bucketName && this.publicBaseUrl) {
      const key = `${folder}/${filename}`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
        }),
      );
      return `${this.publicBaseUrl}/${key}`;
    }
    const dir = join(process.cwd(), "uploads", folder);
    await mkdir(dir, { recursive: true });
    const dest = join(dir, filename);
    await writeFile(dest, buffer);
    return `/uploads/${folder}/${filename}`;
  }

  isS3Mode(): boolean {
    return this.s3 !== null;
  }

  isS3Url(url: string): boolean {
    return !!this.publicBaseUrl && url.startsWith(this.publicBaseUrl + "/");
  }

  async signUrl(url: string, expiresIn = SIGN_EXPIRES_IN): Promise<string> {
    if (!this.s3 || !this.bucketName || !this.publicBaseUrl) return url;

    const now = Date.now();
    const cached = this.urlCache.get(url);
    if (cached && now < cached.expiresAt) {
      // LRU touch: move to the most-recent position.
      this.urlCache.delete(url);
      this.urlCache.set(url, cached);
      return cached.signedUrl;
    }

    const key = url.slice(this.publicBaseUrl.length + 1);
    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      { expiresIn },
    );

    this.urlCache.set(url, { signedUrl, expiresAt: now + CACHE_REUSE_MS });
    while (this.urlCache.size > this.cacheMaxEntries) {
      // Evict the oldest entry (first key in insertion order).
      this.urlCache.delete(this.urlCache.keys().next().value as string);
    }

    return signedUrl;
  }

  // Matches the `src="..."`/`src='...'` of an <img> tag. The non-greedy
  // `[^>]*?` keeps the match inside a single tag and the quote backref (\2)
  // bounds the URL, so other attributes/tags are never touched.
  private static readonly IMG_SRC_RE = /(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi;

  // Strips the presign query (?X-Amz-...) from an S3 URL, recovering the stable
  // canonical object URL. Non-S3 URLs (local /uploads, external) pass through.
  canonicalizeS3Url(url: string): string {
    if (!this.publicBaseUrl) return url;
    const qIdx = url.indexOf("?");
    const base = qIdx >= 0 ? url.slice(0, qIdx) : url;
    return this.isS3Url(base) ? base : url;
  }

  // Rewrites every <img src> S3 URL in an HTML blob to its canonical form.
  // Applied on write so persisted content never holds an expiring signature.
  stripContentSignatures(html: string): string {
    if (!this.publicBaseUrl || !html) return html;
    return html.replace(
      StorageService.IMG_SRC_RE,
      (_m, pre: string, quote: string, src: string) =>
        `${pre}${quote}${this.canonicalizeS3Url(src)}${quote}`,
    );
  }

  // Signs every <img src> S3 URL in an HTML blob (canonicalizing first, so an
  // already-signed src is re-signed fresh). Applied on read/render so the editor
  // and the PDF always receive a valid, non-expired URL. No-op outside S3 mode.
  async signContentUrls(html: string): Promise<string> {
    if (!this.isS3Mode() || !this.publicBaseUrl || !html) return html;
    const matches = [...html.matchAll(StorageService.IMG_SRC_RE)];
    if (!matches.length) return html;
    let result = "";
    let last = 0;
    for (const m of matches) {
      const [full, pre, quote, src] = m as unknown as [string, string, string, string];
      const start = m.index ?? 0;
      result += html.slice(last, start);
      const canonical = this.canonicalizeS3Url(src);
      const signed = this.isS3Url(canonical) ? await this.signUrl(canonical) : src;
      result += `${pre}${quote}${signed}${quote}`;
      last = start + full.length;
    }
    result += html.slice(last);
    return result;
  }

  // Removes expired cache entries. Called by SignedUrlCacheScheduler so memory
  // is reclaimed even for entries that are never read again.
  sweepExpiredUrls(): number {
    const now = Date.now();
    let removed = 0;
    for (const [url, entry] of this.urlCache) {
      if (now >= entry.expiresAt) {
        this.urlCache.delete(url);
        removed++;
      }
    }
    return removed;
  }

  // Reads back a stored object as a Buffer. Used by maintenance scripts that
  // reprocess existing files (e.g. generating missing thumbnails).
  async download(fileUrl: string): Promise<Buffer> {
    if (this.s3 && this.bucketName && this.publicBaseUrl) {
      const key = fileUrl.startsWith(this.publicBaseUrl + "/")
        ? fileUrl.slice(this.publicBaseUrl.length + 1)
        : fileUrl;
      const res = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    const relative = fileUrl.startsWith("/") ? fileUrl.slice(1) : fileUrl;
    return readFile(join(process.cwd(), relative));
  }

  async delete(fileUrl: string): Promise<void> {
    if (this.s3 && this.bucketName && this.publicBaseUrl) {
      const key = fileUrl.startsWith(this.publicBaseUrl + "/")
        ? fileUrl.slice(this.publicBaseUrl.length + 1)
        : fileUrl;
      try {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
        );
      } catch {
        // ignore not-found
      }
      return;
    }
    // Local fallback: fileUrl is like /uploads/folder/filename
    try {
      const relative = fileUrl.startsWith("/") ? fileUrl.slice(1) : fileUrl;
      await unlink(join(process.cwd(), relative));
    } catch {
      // ignore missing file
    }
  }
}
