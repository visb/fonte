import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StorageService } from './storage.service';
import { computeOrphans } from './storage.util';

/** Resultado da reconciliação de órfãos no bucket (story 93). */
export interface StorageReconcileReport {
  /** false = dry-run (nada apagado); true = apagou os órfãos. */
  apply: boolean;
  /** Total de objetos no bucket. */
  bucketObjects: number;
  /** Total de objetos referenciados por algum registro/conteúdo. */
  referencedObjects: number;
  /** Quantos órfãos foram encontrados. */
  orphanCount: number;
  /** Chaves dos objetos órfãos (referência para auditoria). */
  orphanKeys: string[];
  /** Quantos foram efetivamente apagados (0 em dry-run). */
  deletedCount: number;
}

// Colunas simples (uma URL por linha) que guardam mídia no bucket. Inclui linhas
// soft-deleted de propósito: enquanto qualquer registro referenciar o objeto,
// ele NÃO é órfão (conservador — nunca apaga mídia possivelmente em uso).
const URL_COLUMN_SOURCES: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'residents', column: 'photo_url' },
  { table: 'residents', column: 'photo_thumb_url' },
  { table: 'resident_attachments', column: 'file_url' },
  { table: 'resident_documents', column: 'signed_file_url' },
  { table: 'relatives', column: 'photo_url' },
  { table: 'staff', column: 'photo_url' },
  { table: 'house_photos', column: 'url' },
  { table: 'activity_attachments', column: 'file_url' },
  { table: 'bible_course_class_photos', column: 'file_url' },
  { table: 'events', column: 'banner_key' },
  { table: 'payables', column: 'attachment_url' },
  { table: 'payables', column: 'payment_receipt_url' },
  { table: 'resident_follow_ups', column: 'attachment_url' },
  { table: 'resident_receivables', column: 'attachment_url' },
  { table: 'messages', column: 'attachment_url' },
];

@Injectable()
export class StorageReconcileService {
  private readonly logger = new Logger(StorageReconcileService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storage: StorageService,
  ) {}

  /**
   * Varre o bucket e remove (ou apenas lista, em dry-run) os objetos não
   * referenciados por nenhum registro/conteúdo. `apply=false` (default) só
   * relata; `apply=true` apaga cada órfão (best-effort) e loga.
   */
  async reconcile(apply: boolean): Promise<StorageReconcileReport> {
    const referenced = await this.collectReferencedKeys();
    const bucketKeys = await this.storage.listBucketKeys();
    const orphanKeys = computeOrphans(bucketKeys, referenced);

    let deletedCount = 0;
    if (apply) {
      for (const key of orphanKeys) {
        // best-effort: delete já engole not-found; envolve em try p/ não abortar
        // a varredura caso um objeto falhe.
        try {
          await this.storage.delete(key);
          deletedCount++;
          this.logger.log(`reconcile: objeto órfão removido — ${key}`);
        } catch (error) {
          this.logger.warn(
            `reconcile: falha ao remover ${key}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }
    }

    this.logger.log(
      `reconcile (${apply ? 'apply' : 'dry-run'}): ${bucketKeys.length} objetos, ` +
        `${referenced.size} referenciados, ${orphanKeys.length} órfãos, ` +
        `${deletedCount} removidos`,
    );

    return {
      apply,
      bucketObjects: bucketKeys.length,
      referencedObjects: referenced.size,
      orphanCount: orphanKeys.length,
      orphanKeys,
      deletedCount,
    };
  }

  /** Conjunto de chaves de bucket referenciadas por qualquer registro/conteúdo. */
  async collectReferencedKeys(): Promise<Set<string>> {
    const keys = new Set<string>();

    // Colunas simples de URL.
    for (const { table, column } of URL_COLUMN_SOURCES) {
      const rows: Array<Record<string, string | null>> = await this.dataSource.query(
        `SELECT "${column}" AS url FROM "${table}" WHERE "${column}" IS NOT NULL`,
      );
      for (const row of rows) {
        this.addKey(keys, row.url);
      }
    }

    // Conteúdo wysiwyg dos templates: extrai as URLs de imagem do bucket.
    const templates: Array<{ content: string | null }> = await this.dataSource.query(
      `SELECT content FROM document_templates`,
    );
    for (const { content } of templates) {
      if (!content) continue;
      for (const url of this.storage.extractBucketImageUrls(content)) {
        this.addKey(keys, url);
      }
    }

    // Respostas de inscrição em evento: campos `file` guardam a storage key/URL.
    const registrations: Array<{ answers: Record<string, unknown> | null }> =
      await this.dataSource.query(`SELECT answers FROM event_registrations`);
    for (const { answers } of registrations) {
      if (!answers) continue;
      for (const value of Object.values(answers)) {
        if (typeof value === 'string') this.addKey(keys, value);
        else if (Array.isArray(value)) {
          for (const v of value) {
            if (typeof v === 'string') this.addKey(keys, v);
          }
        }
      }
    }

    return keys;
  }

  private addKey(keys: Set<string>, url: string | null | undefined): void {
    const key = this.storage.keyFromUrl(url);
    if (key) keys.add(key);
  }
}
