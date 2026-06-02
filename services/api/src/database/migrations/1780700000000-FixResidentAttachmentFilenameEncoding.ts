import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Existing resident_attachments rows were stored with filenames mangled by
 * multer/busboy's latin1 decoding of multipart names (e.g. "João" saved as
 * "JoÃ£o"). Re-decode each filename latin1 -> utf8 to recover the original.
 *
 * Only rows whose decoding actually changes and yields a valid UTF-8 string
 * (no U+FFFD replacement char) are updated, so plain-ASCII names and any
 * already-correct rows are left untouched. Irreversible; no down().
 */
export class FixResidentAttachmentFilenameEncoding1780700000000 implements MigrationInterface {
  name = 'FixResidentAttachmentFilenameEncoding1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; filename: string }[] = await queryRunner.query(
      `SELECT "id", "filename" FROM "resident_attachments"`,
    );

    for (const { id, filename } of rows) {
      const decoded = Buffer.from(filename, 'latin1').toString('utf8');
      if (decoded === filename || decoded.includes('�')) continue;
      await queryRunner.query(
        `UPDATE "resident_attachments" SET "filename" = $1 WHERE "id" = $2`,
        [decoded, id],
      );
    }
  }

  public async down(): Promise<void> {
    // Data fix only; nothing to revert.
  }
}
