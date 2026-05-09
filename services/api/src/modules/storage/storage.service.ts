import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private s3: S3Client | null = null;
  private bucketName: string | null = null;
  private publicBaseUrl: string | null = null;

  constructor(private config: ConfigService) {
    const bucketName = config.get<string>('AWS_S3_BUCKET_NAME');
    const endpoint = config.get<string>('AWS_ENDPOINT_URL');

    if (bucketName && endpoint) {
      this.bucketName = bucketName;
      this.publicBaseUrl = `${endpoint}/${bucketName}`;
      this.s3 = new S3Client({
        endpoint,
        region: config.get<string>('AWS_DEFAULT_REGION') ?? 'auto',
        credentials: {
          accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
          secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
        },
        forcePathStyle: true,
      });
    }
  }

  async onModuleInit() {
    if (!this.s3) {
      await Promise.all([
        mkdir(join(process.cwd(), 'uploads', 'residents'), { recursive: true }),
        mkdir(join(process.cwd(), 'uploads', 'documents'), { recursive: true }),
        mkdir(join(process.cwd(), 'uploads', 'attachments'), { recursive: true }),
        mkdir(join(process.cwd(), 'uploads', 'houses'), { recursive: true }),
      ]);
    }
  }

  uniqueFilename(originalname: string, prefix = ''): string {
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
    const dest = join(process.cwd(), 'uploads', folder, filename);
    await writeFile(dest, buffer);
    return `/uploads/${folder}/${filename}`;
  }

  async delete(fileUrl: string): Promise<void> {
    if (this.s3 && this.bucketName && this.publicBaseUrl) {
      const key = fileUrl.startsWith(this.publicBaseUrl + '/')
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
      const relative = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
      await unlink(join(process.cwd(), relative));
    } catch {
      // ignore missing file
    }
  }
}
