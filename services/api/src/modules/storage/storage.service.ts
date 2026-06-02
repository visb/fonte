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

@Injectable()
export class StorageService implements OnModuleInit {
  private s3: S3Client | null = null;
  private bucketName: string | null = null;
  private publicBaseUrl: string | null = null;

  constructor(private config: ConfigService) {
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

  async signUrl(url: string, expiresIn = 86400): Promise<string> {
    if (!this.s3 || !this.bucketName || !this.publicBaseUrl) return url;
    const key = url.slice(this.publicBaseUrl.length + 1);
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      { expiresIn },
    );
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
