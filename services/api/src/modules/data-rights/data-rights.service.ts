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
  //
  // As mutações de banco rodam numa única transação: se qualquer passo falhar,
  // nada é confirmado e o erro propaga — nunca reportamos sucesso parcial. Os
  // arquivos do bucket só são removidos APÓS o commit (operação externa, sem
  // rollback), em modo best-effort com log.
  async anonymizeResident(residentId: string): Promise<{ anonymized: boolean; residentId: string }> {
    const resident = (
      await this.dataSource.query('SELECT id, photo_url, photo_thumb_url FROM residents WHERE id = $1', [residentId])
    )[0] as { id: string; photo_url: string | null; photo_thumb_url: string | null } | undefined;
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);

    // Coleta as URLs de arquivos ANTES de zerar as colunas, para limpeza pós-commit.
    const fileUrls: (string | null)[] = [resident.photo_url, resident.photo_thumb_url];
    for (const a of await this.dataSource.query<{ file_url: string | null }[]>(
      'SELECT file_url FROM resident_attachments WHERE resident_id = $1',
      [residentId],
    )) {
      fileUrls.push(a.file_url);
    }
    for (const d of await this.dataSource.query<{ signed_file_url: string | null }[]>(
      'SELECT signed_file_url FROM resident_documents WHERE resident_id = $1 AND signed_file_url IS NOT NULL',
      [residentId],
    )) {
      fileUrls.push(d.signed_file_url);
    }
    for (const m of await this.dataSource.query<{ attachment_url: string | null }[]>(
      'SELECT attachment_url FROM messages WHERE resident_id = $1 AND attachment_url IS NOT NULL',
      [residentId],
    )) {
      fileUrls.push(m.attachment_url);
    }

    await this.dataSource.transaction(async (manager) => {
      // Pseudonimiza o interno e marca soft delete.
      await manager.query(
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
      await manager.query(
        `UPDATE relatives SET name = 'Familiar anonimizado', phone = NULL, photo_url = NULL, deleted_at = now()
         WHERE resident_id = $1`,
        [residentId],
      );
      await manager.query('DELETE FROM resident_attachments WHERE resident_id = $1', [residentId]);

      // Apaga o corpo/anexo das mensagens (texto livre com PII) e soft-delete.
      await manager.query(
        `UPDATE messages SET content = NULL, attachment_url = NULL, attachment_type = NULL, deleted_at = now()
         WHERE resident_id = $1 AND deleted_at IS NULL`,
        [residentId],
      );
    });

    // Pós-commit: limpeza dos arquivos no bucket (best-effort).
    for (const url of fileUrls) await this.deleteFile(url);

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
