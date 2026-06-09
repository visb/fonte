import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StorageService } from '../storage/storage.service';

// LGPD art. 18/19/20 — direitos do titular: portabilidade (export) e
// eliminação/anonimização ("esquecimento"), preservando o que a lei obriga a
// reter (histórico financeiro/admissional).
@Injectable()
export class DataRightsService {
  private readonly logger = new Logger(DataRightsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  private async safeQuery(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
    try {
      return await this.dataSource.query(sql, params);
    } catch (error) {
      this.logger.warn(`Falha em consulta de export: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  // Reúne todos os dados pessoais de um interno (portabilidade, art. 20).
  async exportResident(residentId: string): Promise<Record<string, unknown>> {
    const resident = (await this.safeQuery('SELECT * FROM residents WHERE id = $1', [residentId]))[0];
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);

    const [admissions, relatives, followUps, receivables, documents, attachments, consents, messages] =
      await Promise.all([
        this.safeQuery('SELECT * FROM admissions WHERE resident_id = $1', [residentId]),
        this.safeQuery('SELECT * FROM relatives WHERE resident_id = $1', [residentId]),
        this.safeQuery('SELECT * FROM resident_follow_ups WHERE resident_id = $1', [residentId]),
        this.safeQuery('SELECT * FROM resident_receivables WHERE resident_id = $1', [residentId]),
        this.safeQuery('SELECT * FROM resident_documents WHERE resident_id = $1', [residentId]),
        this.safeQuery('SELECT * FROM resident_attachments WHERE resident_id = $1', [residentId]),
        this.safeQuery(
          "SELECT * FROM consent_records WHERE subject_type = 'RESIDENT' AND subject_id = $1",
          [residentId],
        ),
        this.safeQuery('SELECT * FROM messages WHERE resident_id = $1', [residentId]),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      subject: { type: 'RESIDENT', id: residentId },
      resident,
      admissions,
      relatives,
      followUps,
      receivables,
      documents,
      attachments,
      consents,
      messages,
    };
  }

  // Anonimiza um interno (art. 18, IV/VI). Remove identificadores diretos e
  // arquivos no bucket, soft-delete, preservando o histórico financeiro/legal
  // (admissions, receivables) sem PII associada ao titular.
  async anonymizeResident(residentId: string): Promise<{ anonymized: boolean; residentId: string }> {
    const resident = (
      await this.safeQuery('SELECT id, photo_url, photo_thumb_url FROM residents WHERE id = $1', [residentId])
    )[0] as { id: string; photo_url: string | null; photo_thumb_url: string | null } | undefined;
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);

    // Remove arquivos do bucket (fotos, anexos, documentos assinados).
    await this.deleteFile(resident.photo_url);
    await this.deleteFile(resident.photo_thumb_url);
    for (const a of await this.safeQuery('SELECT file_url FROM resident_attachments WHERE resident_id = $1', [residentId])) {
      await this.deleteFile(a.file_url as string | null);
    }
    for (const d of await this.safeQuery(
      'SELECT signed_file_url FROM resident_documents WHERE resident_id = $1 AND signed_file_url IS NOT NULL',
      [residentId],
    )) {
      await this.deleteFile(d.signed_file_url as string | null);
    }

    // Pseudonimiza o interno e marca soft delete.
    await this.safeQuery(
      `UPDATE residents SET
         name = 'Titular anonimizado', cpf = NULL, rg = NULL, birth_date = NULL,
         nationality = NULL, city = NULL, state = NULL, address = NULL,
         contact_phone = NULL, email = NULL, occupation = NULL, education = NULL,
         religion = NULL, addiction = NULL, health_issues = NULL,
         continuous_medication = NULL, photo_url = NULL, photo_thumb_url = NULL,
         deleted_at = now()
       WHERE id = $1`,
      [residentId],
    );

    // Anonimiza familiares e remove anexos com conteúdo pessoal.
    await this.safeQuery(
      `UPDATE relatives SET name = 'Familiar anonimizado', phone = NULL, photo_url = NULL, deleted_at = now()
       WHERE resident_id = $1`,
      [residentId],
    );
    await this.safeQuery('DELETE FROM resident_attachments WHERE resident_id = $1', [residentId]);

    return { anonymized: true, residentId };
  }

  private async deleteFile(url: string | null): Promise<void> {
    if (!url) return;
    try {
      await this.storageService.delete(url);
    } catch (error) {
      this.logger.warn(`Falha ao remover arquivo ${url}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
