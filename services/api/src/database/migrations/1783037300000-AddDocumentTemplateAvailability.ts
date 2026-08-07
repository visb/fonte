import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 160 — disponibilidade do template de documento por status do filho.
 *
 * `available_for` é ternário (`ALL` | `ACTIVE_ONLY` | `INACTIVE_ONLY`), não uma
 * lista de status: configurar os 9 status por template é granularidade que
 * ninguém pediu. Guardado como varchar (e não enum do Postgres) justamente para
 * um dia virar lista sem ALTER TYPE.
 *
 * `DEFAULT 'ALL'` + NOT NULL, sem backfill: todo template existente continua
 * aparecendo exatamente onde aparece hoje. Quem classifica é o ADM, na tela.
 */
export class AddDocumentTemplateAvailability1783037300000 implements MigrationInterface {
  name = 'AddDocumentTemplateAvailability1783037300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.document_templates
        ADD COLUMN available_for varchar NOT NULL DEFAULT 'ALL'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.document_templates DROP COLUMN available_for
    `);
  }
}
