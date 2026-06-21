import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 74 (áudio): adiciona `duration_seconds` (nullable) em
 * `activity_attachments` para o player exibir a duração de anexos de áudio. O
 * cliente mede a duração e a envia no upload; o backend não decodifica áudio.
 * Aditiva — não destrói nem altera anexos existentes.
 */
export class ActivityAttachmentDuration1784000000000
  implements MigrationInterface
{
  name = 'ActivityAttachmentDuration1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_attachments" ADD "duration_seconds" INTEGER`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_attachments" DROP COLUMN "duration_seconds"`,
    );
  }
}
