import { MigrationInterface, QueryRunner } from 'typeorm';

export class CensusStatuses1781700000000 implements MigrationInterface {
  name = 'CensusStatuses1781700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Novos status de resident para o fluxo de contagem.
    await queryRunner.query(
      `ALTER TYPE "public"."residents_status_enum" ADD VALUE IF NOT EXISTS 'CENSUS_ADDED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."residents_status_enum" ADD VALUE IF NOT EXISTS 'REJECTED_CENSUS'`,
    );

    // Novos tipos de notificação para a contagem.
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'CENSUS_RESIDENT_ADDED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'CENSUS_CONCLUDED'`,
    );
  }

  async down(): Promise<void> {
    // Postgres não suporta remover valores de enum sem recriar o tipo; no-op.
  }
}
