import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona o status ARCHIVED ao enum de status do resident: registro histórico
 * do import em lote sem correspondência na planilha de referência (arquivo
 * morto). `admissions.status` é varchar — só o enum de `residents` muda.
 */
export class AddArchivedResidentStatus1783036800000 implements MigrationInterface {
  name = 'AddArchivedResidentStatus1783036800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE public.residents_status_enum ADD VALUE IF NOT EXISTS 'ARCHIVED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL não suporta remover valor de enum; reverter exigiria recriar o
    // tipo e migrar a coluna. O valor extra é inofensivo — noop intencional.
  }
}
