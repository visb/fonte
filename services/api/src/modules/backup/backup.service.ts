import { spawn } from "child_process";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";

const BACKUP_LOCK_KEY = "weekly-backup";
const DB_PREFIX = "db/";
const FILES_PREFIX = "files/";
const DEFAULT_RETENTION_COUNT = 4;

export interface BackupSummary {
  skipped: boolean;
  reason?: string;
  dumpKey?: string;
  dumpSize?: number;
  filesCopied?: number;
  filesTotal?: number;
  prunedDumps?: string[];
}

export interface BackupListItem {
  key: string;
  size: number;
  createdAt: string;
}

interface S3ObjectInfo {
  key: string;
  size: number;
  lastModified: string;
}

/**
 * Backup do banco (pg_dump) + espelho do bucket de arquivos para um segundo
 * bucket no mesmo provider. Fonte de verdade do histórico é o próprio bucket
 * de backup (sem tabela no Postgres — seria circular). Ver story 20.
 */
@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);

  private readonly s3: S3Client | null = null;
  private readonly backupBucket: string | null;
  private readonly sourceBucket: string | null;
  private readonly databaseUrl: string;
  private readonly pgDumpPath: string;
  private readonly pgRestorePath: string;
  private readonly retentionCount: number;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.backupBucket = config.get<string>("BACKUP_S3_BUCKET_NAME") ?? null;
    this.sourceBucket = config.get<string>("AWS_S3_BUCKET_NAME") ?? null;
    this.databaseUrl = config.get<string>("DATABASE_URL") ?? "";
    this.pgDumpPath = config.get<string>("PG_DUMP_PATH") ?? "pg_dump";
    this.pgRestorePath = config.get<string>("PG_RESTORE_PATH") ?? "pg_restore";
    this.retentionCount =
      config.get<number>("BACKUP_RETENTION_COUNT") ?? DEFAULT_RETENTION_COUNT;
    this.enabled = config.get<string>("BACKUP_ENABLED") === "true";

    const endpoint = config.get<string>("AWS_ENDPOINT_URL");
    // Sobe o cliente se houver qualquer bucket: o backup agendado usa o de
    // backup; o export/import local (CLI) usa só o de origem.
    if (endpoint && (this.backupBucket || this.sourceBucket)) {
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

  onModuleInit() {
    if (this.enabled && !this.isConfigured()) {
      this.logger.warn(
        "BACKUP_ENABLED=true mas backup não está configurado (faltam BACKUP_S3_BUCKET_NAME / AWS_ENDPOINT_URL). Backup automático não vai rodar.",
      );
    }
  }

  /** Bucket de backup + S3 prontos. Origem dos arquivos é opcional (DB-only). */
  isConfigured(): boolean {
    return this.s3 !== null && !!this.backupBucket;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ─── Orquestração ──────────────────────────────────────────────────────────

  /**
   * Roda o backup completo sob advisory lock (uma instância por vez). Retorna
   * `skipped` se não configurado ou se outra instância está rodando.
   */
  async runBackup(): Promise<BackupSummary> {
    if (!this.isConfigured() || !this.s3 || !this.backupBucket) {
      return { skipped: true, reason: "backup não configurado" };
    }

    const lock = await this.dataSource.query(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`,
      [BACKUP_LOCK_KEY],
    );
    if (lock[0]?.acquired !== true) {
      return { skipped: true, reason: "outra instância está rodando" };
    }

    try {
      const { key: dumpKey, size: dumpSize } = await this.backupDatabase();
      const { copied, total } = await this.syncFiles();
      const pruned = await this.pruneOldDumps();
      this.logger.log(
        `Backup concluído: dump ${dumpKey} (${dumpSize} bytes), ${copied}/${total} arquivos copiados, ${pruned.length} dumps removidos`,
      );
      return {
        skipped: false,
        dumpKey,
        dumpSize,
        filesCopied: copied,
        filesTotal: total,
        prunedDumps: pruned,
      };
    } finally {
      await this.dataSource.query(`SELECT pg_advisory_unlock(hashtext($1))`, [
        BACKUP_LOCK_KEY,
      ]);
    }
  }

  // ─── Banco ─────────────────────────────────────────────────────────────────

  /** Dump custom-format do banco enviado ao bucket de backup sob `db/`. */
  async backupDatabase(): Promise<{ key: string; size: number }> {
    const dump = await this.dumpDatabase();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `${DB_PREFIX}${stamp}.dump`;
    await this.putObject(key, dump, "application/octet-stream");
    return { key, size: dump.length };
  }

  /** Lista os dumps disponíveis no bucket, mais recente primeiro. */
  async listBackups(): Promise<BackupListItem[]> {
    if (!this.isConfigured()) return [];
    const objects = await this.listKeys(DB_PREFIX);
    return objects
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((o) => ({ key: o.key, size: o.size, createdAt: o.lastModified }));
  }

  /** Mantém só os N dumps mais recentes; apaga o resto. */
  async pruneOldDumps(): Promise<string[]> {
    const objects = await this.listKeys(DB_PREFIX);
    const sorted = objects.sort((a, b) => b.key.localeCompare(a.key));
    const toDelete = sorted.slice(this.retentionCount);
    for (const o of toDelete) {
      await this.deleteObject(o.key);
    }
    return toDelete.map((o) => o.key);
  }

  // ─── Arquivos ────────────────────────────────────────────────────────────────

  /**
   * Espelho incremental copy-only do bucket de produção para `files/` no bucket
   * de backup. Nunca deleta — protege contra exclusão acidental em produção.
   */
  async syncFiles(): Promise<{ copied: number; total: number }> {
    if (!this.sourceBucket) return { copied: 0, total: 0 };

    const [source, dest] = await Promise.all([
      this.listKeys("", this.sourceBucket),
      this.listKeys(FILES_PREFIX),
    ]);
    const present = new Set(dest.map((o) => o.key.slice(FILES_PREFIX.length)));

    let copied = 0;
    for (const obj of source) {
      if (present.has(obj.key)) continue;
      const destKey = `${FILES_PREFIX}${obj.key}`;
      try {
        await this.copyObject(this.sourceBucket, obj.key, destKey);
      } catch (err) {
        // Fallback: provider sem copy cross-bucket → baixa e reenvia.
        this.logger.warn(
          `CopyObject falhou para ${obj.key}, usando fallback download+put: ${
            err instanceof Error ? err.message : err
          }`,
        );
        const buffer = await this.getObject(this.sourceBucket, obj.key);
        await this.putObject(destKey, buffer, "application/octet-stream");
      }
      copied++;
    }
    return { copied, total: source.length };
  }

  // ─── Export / Import local (CLI) ─────────────────────────────────────────────

  /**
   * Snapshot completo (dump + todos os arquivos) num Buffer .zip para guardar
   * offsite na máquina do operador. `dump.dump` na raiz + objetos sob `files/`.
   */
  async exportToZip(): Promise<Buffer> {
    // Import dinâmico: jszip só é usado pelos comandos CLI.
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const dump = await this.dumpDatabase();
    zip.file("dump.dump", dump);

    if (this.sourceBucket) {
      const objects = await this.listKeys("", this.sourceBucket);
      for (const obj of objects) {
        const buffer = await this.getObject(this.sourceBucket, obj.key);
        zip.file(`${FILES_PREFIX}${obj.key}`, buffer);
      }
    }

    return zip.generateAsync({ type: "nodebuffer" });
  }

  /** Restaura banco + arquivos a partir de um .zip gerado por `exportToZip`. */
  async importFromZip(zipBuffer: Buffer): Promise<{ filesRestored: number }> {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(zipBuffer);

    const dumpEntry = zip.file("dump.dump");
    if (!dumpEntry) {
      throw new BadRequestException("zip inválido: dump.dump não encontrado");
    }
    await this.restoreDatabase(await dumpEntry.async("nodebuffer"));

    let filesRestored = 0;
    if (this.sourceBucket) {
      const entries = zip.file(new RegExp(`^${FILES_PREFIX}`));
      for (const entry of entries) {
        if (entry.dir) continue;
        const key = entry.name.slice(FILES_PREFIX.length);
        const buffer = await entry.async("nodebuffer");
        await this.putObjectTo(this.sourceBucket, key, buffer);
        filesRestored++;
      }
    }
    return { filesRestored };
  }

  // ─── Restore a partir do bucket de backup (CLI) ──────────────────────────────

  /** Restaura o banco a partir de um dump específico no bucket de backup. */
  async restoreDatabaseFromBucket(key: string): Promise<void> {
    if (!this.isConfigured() || !this.backupBucket) {
      throw new BadRequestException("backup não configurado");
    }
    const dump = await this.getObject(this.backupBucket, key);
    await this.restoreDatabase(dump);
  }

  /** Re-copia `files/` do bucket de backup de volta ao bucket de produção. */
  async restoreFilesFromBucket(): Promise<{ restored: number }> {
    if (!this.isConfigured() || !this.sourceBucket) {
      throw new BadRequestException("backup ou bucket de origem não configurado");
    }
    const objects = await this.listKeys(FILES_PREFIX);
    let restored = 0;
    for (const obj of objects) {
      const key = obj.key.slice(FILES_PREFIX.length);
      const buffer = await this.getObject(this.backupBucket!, obj.key);
      await this.putObjectTo(this.sourceBucket, key, buffer);
      restored++;
    }
    return { restored };
  }

  // ─── pg_dump / pg_restore ────────────────────────────────────────────────────

  private dumpDatabase(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.pgDumpPath, [
        "--format=custom",
        "--no-owner",
        "--no-acl",
        this.databaseUrl,
      ]);
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      proc.stdout.on("data", (d: Buffer) => out.push(d));
      proc.stderr.on("data", (d: Buffer) => err.push(d));
      proc.on("error", (e) =>
        reject(
          new Error(
            `pg_dump não pôde iniciar (binário '${this.pgDumpPath}' instalado? precisa ser v16): ${e.message}`,
          ),
        ),
      );
      proc.on("close", (code) =>
        code === 0
          ? resolve(Buffer.concat(out))
          : reject(
              new Error(
                `pg_dump terminou com código ${code}: ${Buffer.concat(err)}`,
              ),
            ),
      );
    });
  }

  private restoreDatabase(dump: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.pgRestorePath, [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        "--dbname",
        this.databaseUrl,
      ]);
      const err: Buffer[] = [];
      proc.stderr.on("data", (d: Buffer) => err.push(d));
      proc.on("error", (e) =>
        reject(
          new Error(
            `pg_restore não pôde iniciar (binário '${this.pgRestorePath}' instalado? precisa ser v16): ${e.message}`,
          ),
        ),
      );
      proc.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(
                `pg_restore terminou com código ${code}: ${Buffer.concat(err)}`,
              ),
            ),
      );
      proc.stdin.write(dump);
      proc.stdin.end();
    });
  }

  // ─── Primitivas S3 (seams testáveis) ─────────────────────────────────────────

  private async listKeys(
    prefix: string,
    bucket = this.backupBucket!,
  ): Promise<S3ObjectInfo[]> {
    const result: S3ObjectInfo[] = [];
    let token: string | undefined;
    do {
      const res = await this.s3!.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix || undefined,
          ContinuationToken: token,
        }),
      );
      for (const o of res.Contents ?? []) {
        if (!o.Key) continue;
        result.push({
          key: o.Key,
          size: o.Size ?? 0,
          lastModified: (o.LastModified ?? new Date()).toISOString(),
        });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return result;
  }

  private async copyObject(
    srcBucket: string,
    srcKey: string,
    destKey: string,
  ): Promise<void> {
    await this.s3!.send(
      new CopyObjectCommand({
        Bucket: this.backupBucket!,
        Key: destKey,
        CopySource: `${srcBucket}/${encodeURIComponent(srcKey)}`,
      }),
    );
  }

  private async deleteObject(key: string): Promise<void> {
    await this.s3!.send(
      new DeleteObjectCommand({ Bucket: this.backupBucket!, Key: key }),
    );
  }

  private async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.putObjectTo(this.backupBucket!, key, body, contentType);
  }

  private async putObjectTo(
    bucket: string,
    key: string,
    body: Buffer,
    contentType = "application/octet-stream",
  ): Promise<void> {
    await this.s3!.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  private async getObject(bucket: string, key: string): Promise<Buffer> {
    const res = await this.s3!.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
